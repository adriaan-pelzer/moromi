const https = require('https');

const buildOptions = ({
  hostname = 'api.blackstack.co.uk',
  path, method = 'GET', ...headers
}) => ({ hostname, port: 443, path, method, headers });

const makeRequest = ({ body, ...params }) => new Promise((resolve, reject) => {
  const req = https.request(buildOptions(params), res => {
    const body = [];
    const { statusCode, headers } = res;
    res.on('data', data => body.push(data));
    res.on('end', () => resolve({ headers, statusCode, body: body.join('') }));
  });
  req.on('error', error => reject(error));
  if (body) { req.write(body); }
  req.end();
});

module.exports = makeRequest;
