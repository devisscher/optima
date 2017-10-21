const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const imagemin = require('imagemin');
const imageminJpegtran = require('imagemin-jpegtran');
const imageminPngquant = require('imagemin-pngquant');

const s3 = new AWS.S3();
// Get objects.
var params = {
  Bucket: config.aws.bucketName,
  MaxKeys: 1000
};
s3.listObjects(params, function(err, data) {
  if (err) {
    console.log(err, err.stack);
  } else {
    console.log(data.Contents);
    const array = data.Contents;
    for (var index = 0; index < array.length; index++) {
      var element = array[index];
      let elementParams = {
        Bucket: config.aws.bucketName,
        Key: element.Key
      };
      getS3ObjectAndOptimize(elementParams);
    }
  }
});
/**
 * 
 * @param {*} params 
 */
function getS3ObjectAndOptimize(params) {
  s3.getObject(params, function(err, data) {
    if (err) {
      console.log(err, err.stack);
    } else {
      console.log('data', data);
      console.log('key', params.Key);
      const filePath = path.join(__dirname, 'temp', params.Key);
      fs.writeFileSync(filePath, new Buffer(data.Body));
      imagemin([filePath], 'build/images', {
        plugins: [
          imageminJpegtran({ quality: '65-80' }),
          imageminPngquant({ quality: '65-80' })
        ]
      }).then(files => {
        console.log(files);
        putS3ObjectBack(files, params.Key);
        //=> [{data: <Buffer 89 50 4e …>, path: 'build/images/foo.jpg'}, …]
      });
    }
  });
}
/**
 * 
 * @param {*} files 
 * @param {*} key 
 */
function putS3ObjectBack(files, key) {
  for (var index = 0; index < files.length; index++) {
    var element = files[index];
    console.log('element', element);
    var params = {
      Body: element.data,
      Bucket: config.aws.bucketName,
      Key: key,
      ServerSideEncryption: 'AES256',
      Tagging: 'key1=new'
    };
    s3.putObject(params, function(err, data) {
      if (err)
        console.log(err, err.stack); // an error occurred
      else console.log(data); // successful response
    });
  }
}
