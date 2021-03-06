const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const config = require('./config');
const imagemin = require('imagemin');
const imageminMozjpeg = require('imagemin-mozjpeg');
const imageminPngquant = require('imagemin-pngquant');
var chalk = require('chalk');
var rimraf = require('rimraf');
const s3 = new AWS.S3();
/**
 * @param {files}
 * this function doesn't work. it isn't used atm.
 */

listAllItemsThatNeedToBeCompressed = files => {
  return new Promise(resolve => {
    var arrayWithoutCompressedObjects = [];
    for (var index = 0; index < files.length; index++) {
      var element = files[index];
      var objectParams = {
        Bucket: config.aws.bucketName,
        Key: files[index].Key
      };
      s3.getObjectTagging(objectParams, function(err, data) {
        if (err) {
          console.log(err, err.stack);
        } else {
          //console.log(data);
          let tags = JSON.stringify(data.TagSet);
          console.log('tags', tags);
          if (tags === JSON.stringify([{ Key: 'compressed', Value: 'true' }])) {
            console.log('FOUND');
            arrayWithoutCompressedObjects.push(objectParams);
          } else {
            console.log('NOT FOUND');
          }
        }
      });
    }
    var array = Array.from(new Set(arrayWithoutCompressedObjects));
    resolve(array);
  });
};
// return new Promise(resolve => {

//     console.log(objectParams);

listAll = params => {
  return new Promise(resolve => {
    s3.listObjects(params, function(err, data) {
      if (err) {
        console.log(err, err.stack);
      } else {
        const array = data.Contents;
        //let arrayWithoutCompressedObjects = [];
        // get only the objects that don't contain the compressed=true key value pair.

        //console.log(arrayWithoutCompressedObjects);

        resolve(array);
      }
    });
  });
};
/**
 * @param {Bucket, Key} 
 */
getS3ObjectAndOptimize = params => {
  return new Promise(resolve => {
    s3.getObject(params, function(err, data) {
      if (err) {
        console.log(err, err.stack);
      } else {
        const filePathName = path.join(__dirname, 'temp', params.Key);
        const filePath = filePathName.substring(
          0,
          filePathName.lastIndexOf('/')
        );
        mkdirp(filePath, function(err) {
          if (err) {
            console.error(err);
          } else {
            fs.writeFileSync(filePathName, new Buffer(data.Body));
            imagemin([filePathName], 'temp', {
              plugins: [
                imageminMozjpeg({ quality: config.aws.jpegQuality }),
                imageminPngquant({ quality: config.aws.pngQuality })
              ]
            }).then(file => {
              resolve(file);
            });
          }
        });
      }
    });
  });
};
/**
   * 
   * @param {*} files 
   * @param {*} key 
   */
putS3ObjectBack = (files, key) => {
  return new Promise(resolve => {
    for (var index = 0; index < files.length; index++) {
      var element = files[index];
      var params = {
        Body: element.data,
        Bucket: config.aws.bucketName,
        Key: key,
        ServerSideEncryption: 'AES256',
        Tagging: 'compressed=true',
        ACL: config.ACL
      };
      s3.putObject(params, function(err, data) {
        if (err) {
          console.log(err, err.stack);
        } else {
          resolve(`${chalk.red('Compressed')} ${params.Key} ✔`);
        }
      });
    }
  });
};
/**
 * Removes the folder in which we stored files temporarily.
 */
cleanFolder = () => {
  return new Promise(resolve => {
    rimraf(path.join(__dirname, 'temp'), function() {
      resolve('done');
    });
  });
};

async function optimize() {
  console.log(chalk.green('Starting to compress objects in bucket.'));
  const params = {
    Bucket: config.aws.bucketName,
    MaxKeys: 1000
  };
  const files = await listAll(params);

  //const filesToBeCompressed = await listAllItemsThatNeedToBeCompressed(files);

  //console.log('to be compressed:', filesToBeCompressed);

  for (var index = 0; index < files.length; index++) {
    var element = files[index];
    let elementParams = {
      Bucket: config.aws.bucketName,
      Key: element.Key
    };

    const file = await getS3ObjectAndOptimize(elementParams);
    const back = await putS3ObjectBack(file, element.Key);
    console.log(back);
  }
  const done = await cleanFolder();
  console.log(chalk.green('Finished compressing objects in bucket'));
}

optimize();
