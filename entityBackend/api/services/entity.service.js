'use strict';

/////////////////////////////////////////////////////////
///////                 constants                 ///////
/////////////////////////////////////////////////////////

const { transactionFactory, UserIdentity, config, tokensFactory } = require('alastria-identity-lib')
const Log = require('log4js')
const keythereum = require('keythereum')
const EthCrypto = require('eth-crypto')
const configHelper = require('../helpers/config.helper')
const myConfig = configHelper.getConfig()
const web3Helper = require('../helpers/web3.helper')
const web3 = web3Helper.getWeb3()
const userModel = require('../models/user.model')
const serviceName = '[Entity Service]'
const log = Log.getLogger()
log.level = myConfig.Log.level

let issuerKeystore = myConfig.issuerKeystore
let issuerIdentity, issuerPrivateKey

/////////////////////////////////////////////////////////
///////             PRIVATE FUNCTIONS             ///////
/////////////////////////////////////////////////////////

function getIssuerIdentity() {
  try {
    log.info(`${serviceName}[${getIssuerIdentity.name}] -----> IN ...`)
    issuerPrivateKey = keythereum.recover(myConfig.addressPassword, issuerKeystore)
    issuerIdentity = new UserIdentity(web3, `0x${issuerKeystore.address}`, issuerPrivateKey)
    log.info(`${serviceName}[${getIssuerIdentity.name}] -----> Issuer Getted`)
    return issuerIdentity
  } catch (error) {
    log.error(`${serviceName}[${getIssuerIdentity.name}] -----> ${error}`)
    throw error
  }
}

function sendSigned(transactionSigned) {
  return new Promise((resolve, reject) => {
    log.info(`${serviceName}[${sendSigned.name}] -----> IN ...`)
    web3.eth.sendSignedTransaction(transactionSigned)
    .on('transactionHash', function (hash) {
      log.info(`${serviceName}[${sendSigned.name}] -----> HASH: ${hash}`)
    })
    .on('receipt', receipt => {
      log.info(`${serviceName}[${sendSigned.name}] -----> Transaction Done`)
      return resolve(receipt)
    })
    .on('error', error => {
      log.error(`${serviceName}[${sendSigned.name}] -----> ${error}`)
      return reject(error)
    });
  })
}

function issuerGetKnownTransaction(issuerCredential) {
  return new Promise((resolve, reject) => {
    let issuerID = getIssuerIdentity()
    issuerID.getKnownTransaction(issuerCredential)
    .then(result => {
      return resolve(result)
    })
    .catch(error => {
      return reject(error)
    })
  })
}

function getAddressFromPubKey(publicKey) {
  try {
    log.info(`${serviceName}[${getAddressFromPubKey.name}] -----> IN ...`)
    let address = EthCrypto.publicKey.toAddress(publicKey)
    log.info(`${serviceName}[${getAddressFromPubKey.name}] -----> Getted address`)
    return address
  }
  catch(error) {
    log.error(`${serviceName}[${getAddressFromPubKey.name}] -----> ${error}`)
    throw error
  }
}

function preparedAlastriaId(subjectAddress) {
  try {
    let preparedId = transactionFactory.identityManager.prepareAlastriaID(web3, subjectAddress)
    return preparedId
  } 
  catch(error) {
    throw error
  }
}

/////////////////////////////////////////////////////////
///////               MODULE EXPORTS              ///////
/////////////////////////////////////////////////////////

module.exports = {
  createAlastriaID,
  addIssuerCredential,
  getIssuerCredentialStatus,
  getCurrentPublicKey,
  getPresentationStatus,
  updateReceiverPresentationStatus,
  getCredentialStatus,
  getPresentationData,
  verifyAlastriaSession
}

/////////////////////////////////////////////////////////
///////              PUBLIC FUNCTIONS             ///////
/////////////////////////////////////////////////////////

function createAlastriaID(params) {
  return new Promise((resolve, reject) => {
    log.info(`${serviceName}[${createAlastriaID.name}] -----> IN ...`)
    let decodedAIC = tokensFactory.tokens.decodeJWT(params.signedAIC)
    let subjectAddress = getAddressFromPubKey(decodedAIC.payload.publicKey)
    let signedCreateTransaction = decodedAIC.payload.createAlastriaTX
    let preparedId = preparedAlastriaId(subjectAddress)
    issuerGetKnownTransaction(preparedId)
    .then(signedPreparedTransaction => {
      sendSigned(signedPreparedTransaction)
      .then(prepareSendSigned => {
        sendSigned(signedCreateTransaction)
        .then(createSendSigned => {
          web3.eth.call({
            to: config.alastriaIdentityManager,
            data: web3.eth.abi.encodeFunctionCall(config.contractsAbi['AlastriaIdentityManager']['identityKeys'], [subjectAddress.substr(2)])
          })
          .then(AlastriaIdentity => {
            let alastriaDID = tokensFactory.tokens.createDID('quor', AlastriaIdentity.slice(26));
            let msg = {
              message: "Successfuly created Alastria ID",
              did: alastriaDID
            }
            return resolve(msg)
          })
          .catch(error => {
            log.error(`${serviceName}[${createAlastriaID.name}] -----> ${error}`)
            return reject(error)
          })
        })
        .catch(error => {
          log.error(`${serviceName}[${createAlastriaID.name}] -----> ${error}`)
          return reject(error)
        })
      })
      .catch(error => {
        log.error(`${serviceName}[${createAlastriaID.name}] -----> ${error}`)
        return reject(error)
      })
    })
    .catch(error => {
      log.error(`${serviceName}[${createAlastriaID.name}] -----> ${error}`)
      return reject(error)
    })
  })
}

function addIssuerCredential(params) {
  return new Promise((resolve, reject) => {
    log.info(`${serviceName}[${addIssuerCredential.name}] -----> IN ...`)
    log.debug(`${serviceName}[${addIssuerCredential.name}] -----> Calling addIssuerCredential With params: ${JSON.stringify(params)}`)
    let result
    // params.issuerCredential.verifiableCredential.map(credential => {
      let credential = params.issuerCredential.verifiableCredential[0]
      console.log(credential)
      let issuerPSMHash = tokensFactory.tokens.PSMHash(web3, credential, myConfig.didIssuer.split(':')[4])
      let issuerCredentialTX = transactionFactory.credentialRegistry.addIssuerCredential(web3, issuerPSMHash)
      issuerGetKnownTransaction(issuerCredentialTX)
      .then(issuerCredentialSigned => {
        sendSigned(issuerCredentialSigned)
        .then(receipt => {
          getIssuerCredentialStatus(issuerPSMHash)
          .then(status => {
            console.log(status)
            result = {
              message: 'Credential saved by issuer',
            }
            log.info(`${serviceName}[${addIssuerCredential.name}] -----> Success: ${result.message}`)
            return resolve(result)
            })
            .catch(error => {
              console.log(error)
            })
          })
          .catch(error => {
            log.error(`${serviceName}[${addIssuerCredential.name}] -----> ${error}`)
            return reject(error)
          })
        })
        .catch(error => {
          log.error(`${serviceName}[${addIssuerCredential.name}] -----> ${error}`)
          return reject(error)
        })
    // })
  })
}

function getIssuerCredentialStatus(psmHash) {
  return new Promise((resolve, reject) => {
    log.info(`${serviceName}[${getIssuerCredentialStatus.name}] -----> IN ...`)
    log.debug(`${serviceName}[${getIssuerCredentialStatus.name}] -----> Calling getIssuerCredentialStatus With params: ${JSON.stringify(psmHash)}`)
    let issuerCredentialTransaction = transactionFactory.credentialRegistry.getIssuerCredentialStatus(web3, myConfig.didIssuer.split(':')[4], psmHash)
    web3.eth.call(issuerCredentialTransaction)
    .then(status => {
      let response = web3.eth.abi.decodeParameters(["bool", "uint8"], status)
      let credentialStatus = response[1]
      log.info(`${serviceName}[${getIssuerCredentialStatus.name}] -----> Success`)
      return resolve(credentialStatus)
    })
    .catch(error => {
      log.error(`${serviceName}[${getIssuerCredentialStatus.name}] -----> ${error}`)
      return reject(error)
    })
  })
}

function getCredentialStatus(subjectStatus, issuerStatus) {
  return new Promise((resolve, reject) => {
    log.info(`${serviceName}[${getCredentialStatus.name}] -----> IN ...`)
    log.debug(`${serviceName}[${getCredentialStatus.name}] -----> Subject Status: ${subjectStatus}, Issuer Status: ${issuerStatus}`)
    let credentialStatusTX = transactionFactory.credentialRegistry.getCredentialStatus(web3, subjectStatus, issuerStatus)
    web3.eth.call(credentialStatusTX)
    .then(status => {
      console.log(status)
      let response = web3.eth.abi.decodeParameter("uint8", status)
      let credentialStatus = response[0]
      log.info(`${serviceName}[${getCredentialStatus.name}] -----> Success`)
      return resolve(credentialStatus)
    })
    .catch(error => {
      log.error(`${serviceName}[${getCredentialStatus.name}] -----> ${error}`)
      return reject(error)
    })
  })
}

function getCurrentPublicKey(subject) {
  return new Promise((resolve, reject) => {
    log.info(`${serviceName}[${getCurrentPublicKey.name}] -----> IN ...`)
    let currentPubKey = transactionFactory.publicKeyRegistry.getCurrentPublicKey(web3, subject.split(':')[4]) // Remove split when the library accepts the DID and not the proxyAddress
    web3.eth.call(currentPubKey)
    .then(result => {
      log.info(`${serviceName}[${getCurrentPublicKey.name}] -----> Public Key Success`)
      let pubKey = web3.eth.abi.decodeParameters(['string'], result) 
      return resolve(pubKey)
    })
    .catch(error => {
      log.error(`${serviceName}[${getCurrentPublicKey.name}] -----> ${error}`)
      return reject(error)
    })
  })
}

function getPresentationStatus(subject, issuer, presentationHash) {
  return new Promise((resolve, reject) => {
    log.info(`${serviceName}[${getPresentationStatus.name}] -----> IN ...`)
    let presentationStatus = null;
    if (issuer != null) {
      presentationStatus = transactionFactory.presentationRegistry.getReceiverPresentationStatus(web3, issuer.split(':')[4], presentationHash);
    } else if (subject != null) {
      presentationStatus = transactionFactory.presentationRegistry.getSubjectPresentationStatus(web3, subject.split(':')[4], presentationHash);
    }
    if (presentationStatus != null) {
      web3.eth.call(presentationStatus)
      .then(result => {
        let resultStatus = web3.eth.abi.decodeParameters(["bool", "uint8"], result)
        let resultStatusJson = {
          exist: resultStatus[0],
          status: resultStatus[1]
        }
        log.info(`${serviceName}[${getPresentationStatus.name}] -----> Presentation Status Success`)
        return resolve(resultStatusJson);
      })
      .catch(error => {
        log.error(`${serviceName}[${getPresentationStatus.name}] -----> ${error}`)
        return reject(error)
      })
    }
  });
}

function updateReceiverPresentationStatus(presentationHash, newStatus) {
  return new Promise((resolve, reject) => {
    log.info(`${serviceName}[${updateReceiverPresentationStatus.name}] -----> IN ...`)
    let updatepresentationStatus = transactionFactory.presentationRegistry.updateReceiverPresentation(web3, presentationHash, newStatus.newStatus);
    issuerGetKnownTransaction(updatepresentationStatus)
    .then(updatepresentationStatusSigned => {
      sendSigned(updatepresentationStatusSigned)
      .then(receipt => {
        log.info(`${serviceName}[${updateReceiverPresentationStatus.name}] -----> Success`)
        return resolve();
      })
      .catch(error => {
        log.error(`${serviceName}[${updateReceiverPresentationStatus.name}] -----> ${error}`)
        return reject(error)
      })
    })
    .catch(error => {
      log.error(`${serviceName}[${updateReceiverPresentationStatus.name}] -----> ${error}`)
      return reject(error)
    })
  })
}

function getPresentationData(data) { 
  return new Promise((resolve, reject) => {
    log.info(`${serviceName}[${getPresentationData.name}] -----> IN ...`) 
    let presentationSigned = data
    let subjectDID = presentationSigned.header.kid
    let subjectPSMHash = presentationSigned.payload.vp.procHash
    getPresentationStatus(subjectDID, null, subjectPSMHash)
    .then(status => {
      log.debug(`${serviceName}[${getPresentationData.name}] -----> STATUS: ${JSON.stringify(status)}`)
      if (status.exist) {
        getCurrentPublicKey(subjectDID)
        .then(subjectPublicKey => {
          let publicKey = subjectPublicKey[0]
          let credentials = []
          let verifiableCredential = presentationSigned.payload.vp.verifiableCredential
          verifiableCredential.map( item => {
            let verifyCredential = tokensFactory.tokens.verifyJWT(item, `04${publicKey}`)
            if(verifyCredential == true) {
              let credential = tokensFactory.tokens.decodeJWT(item)
              credentials.push(JSON.parse(credential.payload).vc.credentialSubject)
            } else {
              log.error(`${serviceName}[${getPresentationData.name}] -----> Error verifying Credential JWT`)
              return reject(verifyCredential)
            }
          })
          log.info(`${serviceName}[${getPresentationData.name}] -----> Credential obtained Success`)
          return resolve(credentials)
        })
        .catch(error => {
          log.error(`${serviceName}[${getPresentationData.name}] -----> ${error}`)
          return reject(error)
        })
      } else {
        let msg = {
          message: 'Presentation not registered'
        }
        log.error(`${serviceName}[${getPresentationData.name}] -----> ${msg.message}`)
        return reject(msg)
      }
    })
    .catch(error => {
      log.error(`${serviceName}[${getPresentationData.name}] -----> ${error}`)
      return reject(error)
    })
  }) 
}

function verifyAlastriaSession(alastriaSession) {
  return new Promise((resolve, reject) => {
    log.info(`${serviceName}[${verifyAlastriaSession.name}] -----> IN...`)
    let decode = tokensFactory.tokens.decodeJWT(alastriaSession.signedAIC)
    let didSubject = decode.payload.pku.id
    log.info(`${serviceName}[${verifyAlastriaSession.name}] -----> Obtained correctly the Subject DID`)
    getCurrentPublicKey(didSubject)
    .then(subjectPublicKey => {
      let publicKey = subjectPublicKey[0]
      log.info(`${serviceName}[${verifyAlastriaSession.name}] -----> Obtained correctly the Subject PublicKey`)
      let verifiedAlastraSession = tokensFactory.tokens.verifyJWT(alastriaSession.signedAIC, `04${publicKey}`)
      if(verifiedAlastraSession == true) {
        userModel.getUser(didSubject)
        .then(user => {
          let msg = {
            message: "User not found",
            did: didSubject
          }
          let result = (user == null) ? msg : user
          return resolve(result)
        })
        .catch(error => {
          log.error(`${serviceName}[${verifyAlastriaSession.name}] -----> ${error}`)
          return reject(error)
        })
      } else {
        log.error(`${serviceName}[${verifyAlastriaSession.name}] -----> Unauthorized`)
        return reject('User Unauthorized')
      }
    })
    .catch(error => {
      log.error(`${serviceName}[${verifyAlastriaSession.name}] -----> ${error}`)
      return reject(error)
    })
  })
 }

