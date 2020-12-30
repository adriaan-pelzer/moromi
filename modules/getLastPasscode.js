const aws = require('aws-sdk');
const s3 = new aws.S3({ region: 'us-east-1' });

const newestItem = Contents => Contents.reduce((newestItem, item) => newestItem.LastModified < item.LastModified
  ? item
  : newestItem
);

const lastObject = (Bucket, Prefix, ContinuationToken, newest) => s3.listObjectsV2({
  Bucket,
  Prefix,
  ContinuationToken
}).promise()
  .then(({ IsTruncated, NextContinuationToken, Contents }) => IsTruncated
    ? lastObject(Bucket, Prefix, NextContinuationToken, newestItem(newest ? [newest, ...Contents] : Contents))
    : newestItem(newest ? [newest, ...Contents] : Contents)
  );

const getLastPasscode = ({ hostname = 'blxtk.com', after = new Date(), mailbox = 'tester' }) => new Promise((resolve, reject) => {
  if (new Date() - after > 60000) {
    return reject(new Error('timeout getting passcode'));
  }
  return resolve(null);
})
  .then(() => lastObject(`mail.${hostname}`, mailbox))
  .then(({ LastModified, Key }) => after > LastModified
    ? getLastPasscode({ hostname, after, mailbox })
    : s3.getObject({ Bucket: `mail.${hostname}`, Key }).promise()
  )
  .then(response => {
    if (!response || !response.Body) {
      return getLastPasscode({ hostname, after, mailbox });
    }
    const match = response.Body.toString('utf8').match(/Your passcode is: (\d{6})/);
    if (!match || !match.length || match.length < 2) {
      return getLastPasscode({ hostname, after, mailbox });
    }
    return { passcode: match[1] };
  });

module.exports = getLastPasscode;
