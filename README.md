# aws-ses-mailer-local

Creates local [Amazon Simple Email Service](https://aws.amazon.com/ses/) compatible server and sends emails using a service of your choice specified in a config file

## Supported Functions
  * [sendEmail(params = {}, callback)](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SES.html#sendEmail-property)
  * [sendRawEmail(params = {}, callback)](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SES.html#sendRawEmail-property)

# Running the server

It's recommended to use docker to run a server
```
docker run -p 9323:9323 -v $(pwd)/config.json:/home/node/config.json yhaiovyi/aws-ses-mailer-local
```
For more details on config file please check `--transport-config` option below.

## CLI Options

| Option  | Short Option | Default | Description |
| --- | --- | --- | --- | 
| `--transport-config` | `-c` | (Ethereal service)[https://ethereal.email/] | Specify config json file path, for available options please refer to (Nodemailer documention)[https://nodemailer.com/smtp/] |
| `--port` | `-p` | `9323` | Specify port for server to run on |

It is also possible to POST your config to `/transport-config` in the runtime `curl -d @transport-config.json http://localhost:9323/transport-config -H "Content-Type: application/json"`

# Using the server

Code example:

```
const AWS - require('aws-sdk')
const ses = new AWS.SES({ region: 'us-east-1', endpoint: 'http://localhost:9323' })
```

`sendEmail()` example:

```
ses.sendEmail({
  Destination: { /* required */
    BccAddresses: [
      'STRING_VALUE'
    ],
    CcAddresses: [
      'STRING_VALUE'
    ],
    ToAddresses: [
      'STRING_VALUE'
    ]
  },
  Message: { /* required */
    Body: { /* required */
      Html: {
        Data: 'STRING_VALUE' /* required */
      },
      Text: {
        Data: 'STRING_VALUE' /* required */
      }
    },
    Subject: { /* required */
      Data: 'STRING_VALUE' /* required */
    }
  },
  Source: 'STRING_VALUE', /* required */
  ReplyToAddresses: [
    'STRING_VALUE'
  ]
})
```

`sendRawEmail()` example:

```
ses.sendEmail({
  RawMessage: {
    Data: 'BINARY_STRING_VALUE' /* required */
  },
})
```