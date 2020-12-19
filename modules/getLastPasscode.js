const aws = require('aws-sdk');
const s3 = new aws.S3({ region: 'us-east-1' });

const Bucket = 'mail.blackstack.co.uk';

const newestItem = Contents => Contents.reduce((newestItem, item) => newestItem.LastModified < item.LastModified
  ? item
  : newestItem
);

const lastObject = (Prefix, ContinuationToken, newest) => s3.listObjectsV2({
  Bucket,
  Prefix,
  ContinuationToken
}).promise()
  .then(({ IsTruncated, NextContinuationToken, Contents }) => IsTruncated
    ? lastObject(Prefix, NextContinuationToken, newestItem(newest ? [newest, ...Contents] : Contents))
    : newestItem(newest ? [newest, ...Contents] : Contents)
  );

const getLastPasscode = ({ after = new Date(), mailbox = 'tester' }) => new Promise((resolve, reject) => {
  if (new Date() - after > 60000) {
    return reject(new Error('timeout getting passcode'));
  }
  return resolve(null);
})
  .then(() => lastObject(mailbox))
  .then(({ LastModified, Key }) => after > LastModified
    ? getLastPasscode({ after, mailbox })
    : s3.getObject({ Bucket, Key }).promise()
  )
  .then(response => {
    if (!response || !response.Body) {
      return getLastPasscode({ after, mailbox });
    }
    const match = response.Body.toString('utf8').match(/Your passcode is: (\d{6})/);
    if (!match || !match.length || match.length < 2) {
      return getLastPasscode({ after, mailbox });
    }
    return { passcode: match[1] };
  });

module.exports = getLastPasscode;
