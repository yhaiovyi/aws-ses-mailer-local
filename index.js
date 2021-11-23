const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const chalk = require('chalk');
const fs = require('fs');
const {
  template, keys, set, compact, cond, isArray, mapValues, isEmpty,
  isPlainObject, stubTrue, identity, join, flow, get, curry, escapeRegExp,
} = require('lodash/fp');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const { log } = console;

const options = yargs(hideBin(process.argv))
  .option('port', {
    alias: 'p',
    type: 'number',
    description: 'endpoint port',
    default: 9323,
  })
  .option('transport-config', {
    alias: 'c',
    type: 'string',
    description: 'nodemailer configuration',
    default: null,
  })
  .argv;

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const errorTemplate = template(fs.readFileSync(`${__dirname}/templates/error.xml`, { encoding: 'utf-8' }));
const successTemplate = template(fs.readFileSync(`${__dirname}/templates/success.xml`, { encoding: 'utf-8' }));

const transportConfigPath = options['transport-config'];
let transportConfig = null;
if (transportConfigPath) {
  try {
    transportConfig = JSON.parse(fs.readFileSync(transportConfigPath, { encoding: 'utf-8' }));
  } catch (e) {
    log('Can not read config file, skipping');
  }
}

async function createEtherealTransport() {
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}

function createTransport(config) {
  return nodemailer.createTransport(config);
}

let transporter;
if (isEmpty(transportConfig)) {
  log(`${chalk.green('Creating Ethereal transport')}`);
  transporter = createEtherealTransport();
} else {
  log(`${chalk.green('Creating transport from config:')}\n${JSON.stringify(transportConfig, null, 2)}`);
  transporter = Promise.resolve(createTransport(transportConfig));
}

const compactObjectArrays = (object) => cond([
  [isArray, flow(compact, join(', '))],
  [isPlainObject, mapValues(compactObjectArrays)],
  [stubTrue, identity],
])(object);

const parseSesArgs = (body) => compactObjectArrays(
  keys(body)
    .reduce((acc, key) => set(key, body[key])(acc), {}),
);

const getRawField = curry((field, rawString) => (
  get(1, rawString.match(new RegExp(`(?:[\n\r]|^)${escapeRegExp(field)}: ([^\n\r]*)`)))
));

async function sendEmail(req, res) {
  const body = parseSesArgs(req.body);

  const mailConfig = {
    from: req.body.Source,
    to: get('Destination.ToAddresses.member', body),
    cc: get('Destination.CcAddresses.member', body),
    bcc: get('Destination.BccAddresses.member', body),
    replyTo: get('ReplyToAddresses.member', body),
    subject: get('Message.Subject.Data', body),
    text: get('Message.Body.Text.Data', body),
    html: get('Message.Body.Html.Data', body),
  };

  if (!(mailConfig.from && mailConfig.subject
    && (mailConfig.html || mailConfig.text) && mailConfig.to)) {
    throw new Error('One or more required fields are missing');
  }

  log(`  📬  ${chalk.green('Email received')}
    ${chalk.blue('From:')} ${mailConfig.from}
    ${chalk.blue('To:')} ${mailConfig.to}
    ${chalk.blue('Subject:')} ${mailConfig.subject}
  `);

  const info = await (await transporter).sendMail(mailConfig);

  log(`   ${chalk.green(`Email sent: ${info.messageId}`)}`);
  log(`   ${chalk.green(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`)}`);

  res.status(200).send(successTemplate({ message: 'OK' }));
}

async function sendRawEmail(req, res) {
  const body = parseSesArgs(req.body);
  const decodedBody = Buffer.from(get('RawMessage.Data', body), 'base64').toString();
  const mailConfig = {
    from: getRawField('From', decodedBody),
    to: getRawField('To', decodedBody),
    subject: getRawField('Subject', decodedBody),
    raw: decodedBody,
  };

  if (!mailConfig.raw) {
    throw new Error('RawMessage.Data is required and was not sent');
  }

  log(`  🍣  ${chalk.green('Raw email received')}
    ${chalk.blue('From:')} ${mailConfig.from}
    ${chalk.blue('To:')} ${mailConfig.to}
    ${chalk.blue('Subject:')} ${mailConfig.subject}
  `);

  const info = await (await transporter).sendMail(mailConfig);

  log(`   ${chalk.green(`Email sent: ${info.messageId}`)}`);
  log(`   ${chalk.green(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`)}`);

  res.status(200).send(successTemplate({ message: 'OK' }));
}

log(`${chalk.inverse('  AWS SES simulator 📪   ')}\n${chalk.green('Listening on port:')} ${options.port}`);

app.post('/', async (req, res) => {
  try {
    switch (req.body.Action) {
      case 'SendEmail':
        await sendEmail(req, res, log);
        break;
      case 'SendRawEmail':
        await sendRawEmail(req, res, log);
        break;
      default:
        throw new Error(`Unsupported action ${req.body.Action}`);
    }
  } catch (err) {
    log(`   ${chalk.red('Error Occured:')} ${err}`);
    res.status(500).send(
      errorTemplate({
        code: 'MessageRejected',
        message: err.message,
      }),
    );
  }
});

app.post('/transport-config', async (req, res) => {
  try {
    const config = req.body;
    console.log(config);
    if (isEmpty(config)) {
      transporter = createEtherealTransport();
      log(`${chalk.green('Updating transport config to Etheral')}`);
    } else {
      log(`${chalk.green('Updating transport config:')}\n${JSON.stringify(config, null, 2)}`);
      transporter = Promise.resolve(createTransport(config));
    }
    res.status(200).json(config);
  } catch (err) {
    log(`   ${chalk.red('Error Occured:')} ${err}`);
    res.status(500).json({ error: err.message });
  }
});

app.listen(options.port);
