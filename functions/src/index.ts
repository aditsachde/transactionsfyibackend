import * as functions from 'firebase-functions';
import { db, plaidClient, runtimeOpts, customFunctions } from './utils'

exports.webhooks = require('./webhooks')

export const webhook = customFunctions.https.onRequest(async (req, res) => {
  await db.collection('webhooks').add(req.body)
  functions.logger.info('recieved webhook')
  res.status(200).send((new Date()).toString())
})

export const newUser = customFunctions.auth.user().onCreate(async (user) => {
  const batch = db.batch()
  batch.set(db.collection('users').doc(user.uid), {
    email: user.email,
    displayName: user.displayName,
    items: [],
  })

  batch.set(db.collection('cubbyhole').doc(user.uid), {})

  await batch.commit()

  functions.logger.info("New user! ", user.uid)
})

export const publicTokenUpdate = functions
  .runWith(runtimeOpts).firestore
  .document('cubbyhole/{userId}/public_token/{document}')
  .onCreate(async (snap, context) => {
    var publicToken: string = snap.data().public_token
    var creds = await plaidClient.exchangePublicToken(publicToken)
    var accounts = await plaidClient.getAccounts(creds.access_token)
    var item = accounts.item


    if (item.webhook !== "https://us-central1-plaidimportfirebase.cloudfunctions.net/webhook") {
      item = (await plaidClient.updateItemWebhook(creds.access_token, 
        "https://us-central1-plaidimportfirebase.cloudfunctions.net/webhook")).item;
    }



    var document = {
      creds: {
        access_token: creds.access_token,
        item_id: creds.item_id
      },
      item: item,
      accounts: accounts.accounts
    }

    var user = db.collection('users').doc(context.params.userId)
    functions.logger.info(document)

    await db.runTransaction(async (t) => {
      var userData = await t.get(user)
      var items: Array<string> = userData.data()?.items
      if (!items.includes(creds.item_id)) {
        items.push(creds.item_id)
      }
      t.update(user, {items: items})

      t.set(db.collection('items').doc(creds.item_id), document)
      t.delete(db.collection('cubbyhole').doc(context.params.userId)
      .collection('public_token').doc(context.params.document))

      functions.logger.info('completed transaction!')

    })

  })