'use strict';

/////////////////////////////////////////////////////////
///////                 constants                 ///////
/////////////////////////////////////////////////////////

const { transactionFactory, config } = require('alastria-identity-lib')
const EthCrypto = require('eth-crypto')
const configHelper = require('../helpers/config.helper')
const myConfig = configHelper.getConfig()
const web3Helper = require('../helpers/web3.helper')
const web3 = web3Helper.getWeb3()
const userModel = require('../models/user.model')
const identityUser = require('../helpers/userIdentity.helper')
const tokenHelper = require('../helpers/token.helper')
const serviceName = '[Entity Service]'
const Log = require('log4js')
const log = Log.getLogger()
const staticUser = require('../../mock/staticUser.js');
log.level = myConfig.Log.level

/////////////////////////////////////////////////////////
///////             PRIVATE FUNCTIONS             ///////
/////////////////////////////////////////////////////////
     
async function sendSigned(transactionSigned) {
  log.info(`${serviceName}[${sendSigned.name}] -----> IN ...`)
  let result = await web3.eth.sendSignedTransaction(transactionSigned)
  .catch(error => {
    log.debug(`${serviceName}[${sendSigned.name}] -----> ${error}`)
    throw error
  })
  log.info(`${serviceName}[${sendSigned.name}] -----> Transaction Sended`)
  return result
}

async function issuerGetKnownTransaction(issuerCredential) {
  try {
    log.info(`${serviceName}[${issuerGetKnownTransaction.name}] -----> IN ...`)
    let issuerID = await identityUser.getUserIdentity(web3, myConfig.entityEthAddress, myConfig.entityPrivateKey)
    let issuerTX = await issuerID.getKnownTransaction(issuerCredential)
    return issuerTX
  }
  catch(error) {
    log.error(`${serviceName}[${issuerGetKnownTransaction.name}] -----> ${error}`)
    throw error
  }
}

function getAddressFromPubKey(publicKey) {
  try {
    log.info(`${serviceName}[${getAddressFromPubKey.name}] -----> IN ...`)
    let address = EthCrypto.publicKey.toAddress(publicKey)
    return address
  }
  catch(error) {
    log.error(`${serviceName}[${getAddressFromPubKey.name}] -----> ${error}`)
    throw error
  }
}

function preparedAlastriaId(subjectAddress) {
  try {
    log.info(`${serviceName}[${preparedAlastriaId.name}] -----> IN ...`)
    let preparedId = transactionFactory.identityManager.prepareAlastriaID(web3, subjectAddress)
    return preparedId
  } 
  catch(error) {
    log.error(`${serviceName}[${preparedAlastriaId.name}] -----> ${error}`)
    throw error
  }
}

/////////////////////////////////////////////////////////
///////               MODULE EXPORTS              ///////
/////////////////////////////////////////////////////////

module.exports = {
  createAlastriaToken,
  verifyAlastriaSession,
  createAlastriaID,
  getCurrentPublicKey,
  getCurrentPublicKeyList,
  addEntity,
  getEntities,
  getEntity,
  addIssuer,
  isIssuer,
  getSubjectCredentialList,
  createCredential,
  updateIssuerCredentialStatus,
  getIssuerCredentialStatus,
  getSubjectCredentialStatus,
  createPresentationRequest,
  getSubjectPresentationList,
  getSubjectPresentationStatus,
  updateReceiverPresentationStatus,
  getIssuerPresentationStatus,
  getPresentationData
}

/////////////////////////////////////////////////////////
///////              PUBLIC FUNCTIONS             ///////
/////////////////////////////////////////////////////////

async function createAlastriaToken() {
  try {
    log.info(`${serviceName}[${createAlastriaToken.name}] -----> IN ...`)
    const currentDate = Math.floor(Date.now() / 1000);
    const expDate = currentDate + 600;
    let alastriaTokenData = {
      iss: myConfig.entityDID,
      gwu: myConfig.nodeUrl.alastria,
      cbu: `${myConfig.callbackUrl}alastria/did`,
      exp: expDate,
      ani: myConfig.netID,
      nbf: currentDate,
      jti: Math.random().toString(36).substring(2)
    }
    let alastriaToken = tokenHelper.createAlastriaToken(alastriaTokenData)
    let AlastriaTokenSigned = tokenHelper.signJWT(alastriaToken, myConfig.entityPrivateKey)
    return AlastriaTokenSigned
  }
  catch(error) {
    log.error(`${serviceName}[${createAlastriaToken.name}] -----> ${error}`)
    throw error
  }
}

async function verifyAlastriaSession(alastriaSession) {
  try {
    log.info(`${serviceName}[${verifyAlastriaSession.name}] -----> IN...`)
    let decodeAS = tokenHelper.decodeJWT(alastriaSession)
    let didSubject = decodeAS.payload.pku.id
    log.info(`${serviceName}[${verifyAlastriaSession.name}] -----> Obtained correctly the Subject DID`)
    let subjectPublicKey = await getCurrentPublicKey(didSubject)
    let publicKey = subjectPublicKey[0]
    log.info(`${serviceName}[${verifyAlastriaSession.name}] -----> Obtained correctly the Subject PublicKey`)
    let verifiedAlastraSession = tokenHelper.verifyJWT(alastriaSession, `04${publicKey}`)
    if(verifiedAlastraSession == true) {
      let user = await userModel.getUser(didSubject)
      let msg = {
        message: "User not found, Unauthorized",
        did: didSubject
      }
      let result = (user == null) ? msg : user
      return result
    } else {
      log.error(`${serviceName}[${verifyAlastriaSession.name}] -----> Error verifying the Alastria Session`)
      throw 'User Unauthorized'
    }

  }
  catch(error) {
    log.error(`${serviceName}[${verifyAlastriaSession.name}] -----> ${error}`)
    throw error
  }
 }

 async function createAlastriaID(params) {
  try {
    log.info(`${serviceName}[${createAlastriaID.name}] -----> IN ...`)
    let decodedAIC = tokenHelper.decodeJWT(params)
    let subjectAddress = getAddressFromPubKey(decodedAIC.payload.publicKey)
    let signedCreateTransaction = decodedAIC.payload.createAlastriaTX
    let preparedId = preparedAlastriaId(subjectAddress)
    let signedPreparedTransaction = await issuerGetKnownTransaction(preparedId)
    let prepareSendSigned = await sendSigned(signedPreparedTransaction)
    let createSendSigned = await sendSigned(signedCreateTransaction)
    let alastriaIdentity = await web3.eth.call({
      to: config.alastriaIdentityManager,
      data: web3.eth.abi.encodeFunctionCall(config.contractsAbi['AlastriaIdentityManager']['identityKeys'], [subjectAddress.substr(2)])
    })
    let alastriaDID = tokenHelper.createDID('quor', alastriaIdentity.slice(26));
    let msg = {
      message: "Successfuly created Alastria ID",
      did: alastriaDID
    }
    return msg
  }
  catch(error) {
    log.error(`${serviceName}[${createAlastriaID.name}] -----> ${error}`)
    throw error
  }
}

async function getCurrentPublicKey(subject) {
  try {
    log.info(`${serviceName}[${getCurrentPublicKey.name}] -----> IN ...`)
    let currentPubKey = await transactionFactory.publicKeyRegistry.getCurrentPublicKey(web3, subject.split(':')[4]) // Remove split when the library accepts the DID and not the proxyAddress
    let result = await web3.eth.call(currentPubKey)
    log.info(`${serviceName}[${getCurrentPublicKey.name}] -----> Public Key Success`)
    let identityPubKey = web3.eth.abi.decodeParameters(['string'], result) 
    return identityPubKey[0]
  }
  catch(error) {
    log.error(`${serviceName}[${getCurrentPublicKey.name}] -----> ${error}`)
    throw error
  }
}

async function getCurrentPublicKeyList(subject) {
  try {
    log.info(`${serviceName}[${getCurrentPublicKeyList.name}] -----> IN ...`)
    let publicKeyList = []
    let currentPubKey = await transactionFactory.publicKeyRegistry.getCurrentPublicKey(web3, subject.split(':')[4])
    let result = await web3.eth.call(currentPubKey)
    log.info(`${serviceName}[${getCurrentPublicKey.name}] -----> Public Key Success`)
    let identityPubKey = web3.eth.abi.decodeParameters(['string'], result)
    let publicKeyStatus = await transactionFactory.publicKeyRegistry.getPublicKeyStatus(web3, subject.split(':')[4], identityPubKey[0])
    publicKeyList.push(publicKeyStatus)
    return publicKeyList
  }
  catch(error) {
    log.error(`${serviceName}[${getCurrentPublicKeyList.name}] -----> ${error.message.split(':')[0]}`)
    throw error.message.split(':')[0]
  }
}

async function addEntity(entityData) {
  try {
    log.info(`${serviceName}[${addEntity.name}] -----> IN ...`)
    let entity = await getEntity(entityData.didEntity)
    if(entity) {
      throw "This AlastriaDID is already an Entity"
    }
    let entityTX = await transactionFactory.identityManager.addEntity(web3, entityData.didEntity.split(':')[4], entityData.name, entityData.cif,
                                                                        entityData.logoURL, entityData.createAlastriaIdentityURL, entityData.alastriaOpenAccessURL,
                                                                        entityData.active)
    let entitySignedTX = await issuerGetKnownTransaction(entityTX)
    let sendSignedTX = await sendSigned(entitySignedTX)
    log.info(`${serviceName}[${addEntity.name}] -----> Added New Entity`)
    entity = await getEntity(entityData.didEntity)
    return entity
  }
  catch(error) {
    log.error(`${serviceName}[${addEntity.name}] -----> ${error}`)
    throw error
  }
}

async function getEntities() {
  try {
    log.info(`${serviceName}[${getEntities.name}] -----> IN ...`)
    let entitiesList = await transactionFactory.identityManager.entitiesList(web3)
    let list = await web3.eth.call(entitiesList)
		let resultList = web3.eth.abi.decodeParameter("address[]", list)
    log.info(`${serviceName}[${getEntities.name}] -----> Getted Entities List`)
    return resultList
  }
  catch(error) {
    log.error(`${serviceName}[${getEntities.name}] -----> ${error}`)
    throw error
  }
}

async function getEntity(entityDID) {
  try {
    log.info(`${serviceName}[${getEntity.name}] -----> IN ...`)
    let entityTX = await transactionFactory.identityManager.getEntity(web3, entityDID.split(':')[4])
    let result = await web3.eth.call(entityTX)
    let entityDecode = web3.eth.abi.decodeParameters(["string", "string", "string", "string", "string", "bool"], result)
    let entity = {
      "name": entityDecode[0],
      "cif":entityDecode[1],
      "urlLogo":entityDecode[2],
      "urlCreateAID":entityDecode[3],
      "urlAOA":entityDecode[4],
      "status":entityDecode[5]
    }
    log.info(`${serviceName}[${getEntity.name}] -----> Getted Entity Data`)
    if(entity.status == false) {
      throw "This AlastriaDID is not an Entity"
    }
    return entity
  }
  catch(error) {
    log.error(`${serviceName}[${getEntity.name}] -----> ${error}`)
    throw error
  }
}

async function addIssuer(issuerData) {
  try {
    log.info(`${serviceName}[${addIssuer.name}] -----> IN ...`)
    let issuer = await isIssuer(issuerData.didEntity)
    if(issuer) {
      throw " This EntityDID is already an Issuer"
    }
    let addIssuerTX = await transactionFactory.identityManager.addIdentityIssuer(web3, issuerData.didEntity.split(':')[4], issuerData.eidasLevel)
    let issuerSignedTX = await issuerGetKnownTransaction(addIssuerTX)
    let sendSignedTX = await sendSigned(issuerSignedTX)
    log.info(`${serviceName}[${addIssuer.name}] -----> Added New Issuer`)
    issuer = await isIssuer(issuerData.didEntity)
    return issuer
  }
  catch(error) {
    log.error(`${serviceName}[${addIssuer.name}] -----> ${error}`)
    throw error
  }
}

async function isIssuer(issuerDID) {
  try {
    log.info(`${serviceName}[${isIssuer.name}] -----> IN ...`)
    let issuer = await transactionFactory.identityManager.isIdentityIssuer(web3, issuerDID.split(':')[4])
    let isIssuerStatus = await web3.eth.call(issuer)
    let result = web3.eth.abi.decodeParameter("bool", isIssuerStatus)
    log.info(`${serviceName}[${isIssuer.name}] -----> Getted Issuer status`)
    return result
  }
  catch(error) {
    log.error(`${serviceName}[${isIssuer.name}] -----> ${error}`)
    throw error
  }
}

async function getSubjectCredentialList(identityDID){
  try {
    log.info(`${serviceName}[${getSubjectCredentialList.name}] -----> IN ...`)
    let listTX = await transactionFactory.credentialRegistry.getSubjectCredentialList(web3, identityDID.split(':')[4])
    let credentialCall = await web3.eth.call(listTX)
    let listDecoded = web3.eth.abi.decodeParameters(["uint256", "bytes32[]"], credentialCall)
    let list = {
      index: listDecoded[0],
      credential: listDecoded[1]
    }
    return list
  }
  catch(error) {
    log.error(`${serviceName}[${getSubjectCredentialList.name}] -----> ${error}`)
    throw error
  }
}

async function createCredential(identityDID, credentials) {
  try {
    log.info(`${serviceName}[${createCredential.name}] -----> IN ...`)
    let user = process.env.DEBUG ? staticUser : await userModel.getUser(identityDID);
    let credentialsJWT = []
    let credentialsTXSigned = []
    let sendCredentialTX = []
    credentials.map(async credential => {
      let credentialSubject = {}
      const currentDate = Math.floor(Date.now() / 1000);
      const expDate = currentDate + 600;
      let jti = Math.random().toString(36).substring(2)
      credentialSubject =  {
        "levelOfAssurance": "Basic",
        "name_credential": "cred_covid19",
        "fullname_credential":"PERMISO LABORAL COVID-19",
        "entity_issuer": "Grant Thornton",
        "status_credential": true,
        "description_credential":"Breve descripción sobre la credencial de covid19 para ir a trabajar"
      }
      let credentialObject = tokenHelper.createCredential(myConfig.entityDID, myConfig.entityDID, identityDID,
                                                                myConfig.context, credentialSubject, expDate, currentDate, jti)
      let credentialSigned = tokenHelper.signJWT(credentialObject, myConfig.entityPrivateKey)
      let credentialPsmHash = tokenHelper.psmHash(web3, credentialSigned, myConfig.entityDID)
      let credentialTX = transactionFactory.credentialRegistry.addIssuerCredential(web3, credentialPsmHash)
      credentialsTXSigned.push(credentialTX)
      credentialsJWT.push(credentialSigned)
    })
    credentialsTXSigned.map(async (item) => {
      let issuerTXSigned = await issuerGetKnownTransaction(item)
      log.info(`${serviceName}[${createCredential.name}] -----> Preparing to send transaction`)
      sendCredentialTX.push(issuerTXSigned)
      sendCredentialTX.map(async TXToSend => {
        log.info(`${serviceName}[${createCredential.name}] -----> Sending transaction`)
        let sendSignedCredential = await sendSigned(TXToSend)
      })
    })
    log.info(`${serviceName}[${createCredential.name}] -----> Created Successfully`)
    return credentialsJWT
  }
  catch(error){
    log.error(`${serviceName}[${createCredential.name}] -----> ${error}`)
    throw error
  }
}

async function getSubjectCredentialStatus(subjectDID, subjectPSMHash) {
  try {
    log.info(`${serviceName}[${getSubjectCredentialStatus.name}] -----> IN ...`)
    let credentialStatusCall = await transactionFactory.credentialRegistry.getSubjectCredentialStatus(web3, subjectDID.split(':')[4], subjectPSMHash)
    let statusObject = await web3.eth.call(credentialStatusCall)
    let resultStatus = await web3.eth.abi.decodeParameters(['bool', 'uint8'], statusObject)
    if(!resultStatus[0]) {
      throw "Credential not exist"
    }
    log.info(`${serviceName}[${getSubjectCredentialStatus.name}] -----> Obtained status`)
    return resultStatus[1]
  }
  catch(error) {
    log.error(`${serviceName}[${getSubjectCredentialStatus.name}] -----> ${error}`)
    throw error
  }
}

async function updateIssuerCredentialStatus(updateData) {
  try {
    log.info(`${serviceName}[${updateIssuerCredentialStatus.name}] -----> IN ...`)
    let updateTX = transactionFactory.credentialRegistry.updateCredentialStatus(web3, updateData.credentialHash, updateData.status)
    let updateTXSigned = await issuerGetKnownTransaction(updateTX)
    let sendUpdateTX = await sendSigned(updateTXSigned)
    let issuerCredentialUpdated = await getIssuerCredentialStatus(myConfig.entityDID, updateData.credentialHash)
    let updatedStatus = issuerCredentialUpdated
    log.info(`${serviceName}[${updateIssuerCredentialStatus.name}] -----> Credential status updated`)
    return updatedStatus
  }
  catch(error) {
    log.error(`${serviceName}[${updateIssuerCredentialStatus.name}] -----> ${error}`)
    throw error
  }
}

async function getIssuerCredentialStatus(identityDID, credentialHash) {
  try {
    log.info(`${serviceName}[${getIssuerCredentialStatus.name}] -----> IN ...`)
    let issuerCredential = await transactionFactory.credentialRegistry.getIssuerCredentialStatus(web3, identityDID.split(':')[4], credentialHash)
    let issuerCredentialCall = await web3.eth.call(issuerCredential)
    let result = web3.eth.abi.decodeParameters(["bool", "uint8"], issuerCredentialCall)
    let status = result[1]
    log.info(`${serviceName}[${getIssuerCredentialStatus.name}] -----> Credential status getted`)
    return status
  }
  catch(errror) {
    log.error(`${serviceName}[${getIssuerCredentialStatus.name}] -----> ${error}`)
    throw error
  }
}

async function createPresentationRequest(requestData) {
  try {
    log.info(`${serviceName}[${createPresentationRequest.name}] -----> IN ...`)
    const currentDate = Math.floor(Date.now() / 1000);
    const expDate = currentDate + 600;
    let jti = Math.random().toString(36).substring(2)
    let objectRequest = tokenHelper.createPresentationRequest(myConfig.entityDID, myConfig.entityDID, myConfig.context,
                                                                   `${myConfig.callbackUrl}alastria/presentation`, myConfig.procHash, requestData,
                                                                    expDate, currentDate, jti)
    let presentationRequest = tokenHelper.signJWT(objectRequest, myConfig.entityPrivateKey)
    return presentationRequest
  }
  catch(error) {
    log.error(`${serviceName}[${createPresentationRequest.name}] -----> ${error}`)
    throw error
  }
}

async function getSubjectPresentationList(subjectDID) {
  try {
    log.info(`${serviceName}[${getSubjectPresentationList.name}] -----> IN ...`)
    let listTX = transactionFactory.presentationRegistry.getSubjectPresentationList(web3, subjectDID.split(':')[4])
    let listCall = await web3.eth.call(listTX)
    let listDecoded = web3.eth.abi.decodeParameters(['uint256', 'bytes32[]'], listCall)
    let presentationList = listDecoded[1]
    log.info(`${serviceName}[${getSubjectPresentationList.name}] -----> Obtained presentation list`)
    return presentationList
  }
  catch(error) {
    log.error(`${serviceName}[${createPresentationRequest.name}] -----> ${error}`)
    throw error
  }
}

async function getSubjectPresentationStatus(subjectDID, subejectPresentationHash) {
  try {
    log.info(`${serviceName}[${getSubjectPresentationStatus.name}] -----> IN ...`)
    let statusTX = transactionFactory.presentationRegistry.getSubjectPresentationStatus(web3, subjectDID.split(':')[4], subejectPresentationHash)
    let statusCall = await web3.eth.call(statusTX)
    let statusDecoded = web3.eth.abi.decodeParameters(['bool', 'uint8'], statusCall)
    console.log(statusDecoded)
    if(!statusDecoded[0]) {
      throw 'Presentation not registered'
    }
    log.info(`${serviceName}[${getSubjectPresentationStatus.name}] -----> Presentation status getted`)
    return statusDecoded[1]
  }
  catch(error) {
    log.error(`${serviceName}[${getSubjectPresentationStatus.name}] -----> ${error}`)
    throw error
  }
}

async function updateReceiverPresentationStatus(presentationHash, newStatus) {
  try {
    log.info(`${serviceName}[${updateReceiverPresentationStatus.name}] -----> IN ...`)
    let updatePresentatioTX = transactionFactory.presentationRegistry.updateReceiverPresentation(web3, presentationHash, newStatus)
    let updatedPresentationTXSigned = await issuerGetKnownTransaction(updatePresentatioTX)
    let updateSendedTX = await sendSigned(updatedPresentationTXSigned)
    log.info(`${serviceName}[${updateReceiverPresentationStatus.name}] -----> Presentation updated`)
    let updatedPresentationStatus = await getIssuerPresentationStatus(myConfig.entityDID, presentationHash)
    return updatedPresentationStatus
  }
  catch(error) {
    log.error(`${serviceName}[${updateReceiverPresentationStatus.name}] -----> ${error}`)
    throw error
  }
}

async function getIssuerPresentationStatus(issuerDID, presentationHash) {
  try {
    log.info(`${serviceName}[${getIssuerPresentationStatus.name}] -----> IN ...`)
    let statusTX = transactionFactory.presentationRegistry.getReceiverPresentationStatus(web3, issuerDID.split(':')[4], presentationHash)
    let statusCall = await web3.eth.call(statusTX)
    let statusDecoded = web3.eth.abi.decodeParameters(['bool', 'uint8'], statusCall)
    if(!statusDecoded[0]) {
      throw 'Presentation not registered'
    }
    log.info(`${serviceName}[${getIssuerPresentationStatus.name}] -----> Presentation status getted`)
    return statusDecoded[1]
  }
  catch(error) {
    log.error(`${serviceName}[${getIssuerPresentationStatus.name}] -----> ${error}`)
    throw error
  }
}

async function getPresentationData(presentationData, presentationPSMHash) {
  try {
    log.info(`${serviceName}[${getPresentationData.name}] -----> IN ...`)
    let credentials = []
    let presentationDecoded = tokenHelper.decodeJWT(presentationData)
    let subjectPublicKey = await getCurrentPublicKey(presentationDecoded.header.kid)
    let presentationVerified = tokenHelper.verifyJWT(presentationData, subjectPublicKey)
    if(!presentationVerified) {
      throw 'Presentation not verified'
    }
    let issuerPresentationPSMHash = tokenHelper.psmHash(web3, presentationData, myConfig.entityDID)
    let subjectPresentationStatus = await getSubjectPresentationStatus(presentationDecoded.header.kid, presentationPSMHash)
    let updatePresentationStatus = await updateReceiverPresentationStatus(issuerPresentationPSMHash, 2)
    let verifiableCredential = presentationDecoded.payload.vp.verifiableCredential
    verifiableCredential.map(item => {
      let verifyCredential = tokenHelper.verifyJWT(item, subjectPublicKey)
      if(!verifyCredential) {
        throw 'Error verifying Credential JWT'
      }
      let credential = tokenHelper.decodeJWT(item)
      credentials.push(credential.payload.vc.credentialSubject)
    })
    return credentials
  }
  catch(error) {
    log.error(`${serviceName}[${getPresentationData.name}] -----> ${error}`)
    throw error
  }
}
