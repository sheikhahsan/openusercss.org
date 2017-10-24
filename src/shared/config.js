/* eslint no-process-env:0 */

import Conf from 'conf'
import hat from 'hat'
import log from 'chalk-console'
import cp from 'node-cp'
import path from 'path'
import selfsigned from 'selfsigned'
import {defaultsDeep} from 'lodash'

export const inProd = () => {
  if (process.env.NODE_ENV !== 'production') {
    return false
  }

  return true
}

let defaultConfig = {
  'env':   'production',
  'ports': {
    'api': {
      'http':  5000,
      'https': 5001
    },
    'frontent': {
      'http':  5010,
      'https': 5011
    }
  },
  'domain':     'openusercss.org',
  'saltRounds': 15,
  'database':   {
    'main':  'mongodb://localhost:27017/openusercss-main',
    'brute': 'mongodb://localhost:27017/openusercss-brute'
  }
}

if (!inProd()) {
  log.warn('App in development mode, configuration is set to low security!')

  defaultConfig = defaultsDeep({
    'env':        'development',
    'saltRounds': 11
  }, defaultConfig)
}

const genKeypair = () => {
  log.warn('A new keypair is being generated. All users will be logged out when the app starts.')

  const generationStart = Date.now()
  let pem = null

  if (inProd()) {
    pem = selfsigned.generate(null, {
      'keySize':    4096,
      'algorithm':  'sha256',
      'extensions': [
        {'name': 'basicConstraints'}
      ],
      'clientCertificate':   true,
      'clientCertificateCN': '*'
    })
  } else {
    log.warn('App in development mode, the new keypair is very weak!')
    pem = selfsigned.generate(null, {
      'keySize':    512,
      'algorithm':  'sha256',
      'extensions': [
        {'name': 'basicConstraints'}
      ],
      'clientCertificate':   true,
      'clientCertificateCN': '*'
    })
  }

  log.info(`Keypair generated in ${Date.now() - generationStart}ms`)
  return pem
}

const initConfig = () => {
  /*
   * WARNING
   * While the configKey does encrypt the contents of our config.json,
   * it musn't be relied on for security, as said key is written to disk
   * in plain text.
   *
   * It's only useful for deterring users from editing the file
   * and for checking integrity!
   *
   * Nevertheless, we can write our keys into it, because we expect the
   * system administrator to properly secure the runtime environment.
   */

  const secretsConfig = new Conf({
    'cwd':        __dirname,
    'configName': 'secrets'
  })
  const configKey = secretsConfig.get('configKey')
  const newVersion = `${Date.now()}.${hat(8)}`

  if (!secretsConfig.get('version')) {
    secretsConfig.set('version', newVersion)
  }
  if (!configKey) {
    cp(path.join(__dirname, 'secrets.json'), path.join(__dirname, `bkup.${newVersion}.secrets`))
    cp(path.join(__dirname, 'config.json'), path.join(__dirname, `bkup.${newVersion}.config`))

    log.error('Unable to decrypt config.json, because our secrets.json is either missing or corrupt!')
    log.warn('Your configuration options have been reset to defaults')
    log.warn('A backup of your previous config has been made, just in case')
    log.warn(`You can find your backups here:
  ${path.join(__dirname, `bkup.${newVersion}`)}
    `)

    secretsConfig.set('configKey', hat(256))
    secretsConfig.set('version', newVersion)
  }

  const conf = new Conf({
    'cwd':           __dirname,
    'configName':    'config',
    'encryptionKey': secretsConfig.get('configKey'),
    'defaults':      defaultConfig
  })

  if (!conf.get('version')) {
    conf.set('version', newVersion)
  }
  if (!conf.get('keypair')) {
    conf.set('keypair', genKeypair())
  }

  return conf
}

const config = initConfig()
const staticConfig = async () => {
  return config
}

(async () => {
  if (!inProd()) {
    log.info(`\n${config.get('keypair').private}`)
    log.info(`\n${config.get('keypair').public}`)
  }

  log.info(`Loaded configuration, version ${config.get('version')}`)
})()

export default staticConfig