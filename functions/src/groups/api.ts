import * as functions from 'firebase-functions';
import { db, plaidClient, customFunctions } from '../utils/utils'
import { webhook, publicToken, newCheckoutSession } from '../utils/schemas'
import Stripe from 'stripe';
const stripe = new Stripe('sk_test_51HBnbiFbBJyOwYq8jes5cpgGTB5GedJ74aGaumOIbZmsDVQzRDWGrbXU9mCZrmZRofnWCQnHCZ9ZHLVmXR6XWfZO00qpHtbfE5', {
  apiVersion: '2020-03-02',
});

exports.updateWebhook = customFunctions.https.onCall(async (data, context) => {
  if (!context.auth) {
    return { message: 'Authentication Required!', code: 401 };
  }

  var santized = await webhook.validate(data)
  if (typeof santized === 'undefined') {
    return { code: 400 }
  }

  const batch = db.batch()

  batch.update(db.collection('users').doc(context.auth.uid), {
    webhookUrl: santized.webhookUrl,
    webhook: true
  })

  batch.update(db.collection('cubbyhole').doc(context.auth.uid), {
    webhookUrl: santized.webhookUrl,
    webhook: true
  })

  await batch.commit()

  return { status: 200 }

})

exports.fetchCheckoutSession = customFunctions.https.onCall(async (data, context) => {
  if (!context.auth) {
    return { message: 'Authentication Required!', code: 401 };
  }

  var santized = await newCheckoutSession.validate(data)
  if (typeof santized === 'undefined') {
    return { code: 400 }
  }

  var user = (await db.collection("users").doc(context.auth.uid).get()).data();
  if (typeof user === 'undefined') {
    return { code: 400 }
  }

  const line_items = (santized.addons === 0) ? [{
    // Base price
    price: 'price_1HCW4pFbBJyOwYq888YRfQGE',
    quantity: 1,
  },
  ] : [{
    // Base price
    price: 'price_1HCW4pFbBJyOwYq888YRfQGE',
    quantity: 1,
  },
  {
    // Bank addon
    price: 'price_1HCW57FbBJyOwYq8CJbQ4KL8',
    quantity: santized.addons,
  }
  ]

  var session = await stripe.checkout.sessions.create({
    customer: user.customer_id,
    payment_method_types: ['card'],
    line_items: line_items,
    mode: 'subscription',
    success_url: 'http://localhost:8000/dash?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'http://localhost:8000/dash',
  })

  return { sessionId: session.id }

})

exports.fetchPortalSession = customFunctions.https.onCall(async (data, context) => {
  if (!context.auth) {
    return { message: 'Authentication Required!', code: 401 };
  }

  var user = (await db.collection("users").doc(context.auth.uid).get()).data();
  if (typeof user === 'undefined') {
    return { code: 400 }
  }

  var session = await stripe.billingPortal.sessions.create({
    customer: user.customer_id,
    return_url: "http://localhost:8000/",
  })

  return { url: session.url }

})

exports.newPublicToken = customFunctions.https.onCall(async (data, context) => {
  if (!context.auth) {
    return { message: 'Authentication Required!', code: 401 };
  }

  var santized = await publicToken.validate(data)

  if (typeof santized === 'undefined') {
    return { code: 400 }
  }

  var creds = await plaidClient.exchangePublicToken(santized.publicToken)
  var accounts = await plaidClient.getAccounts(creds.access_token)
  var item = accounts.item

  if (item.webhook !== "https://us-east4-plaidimportfirebase.cloudfunctions.net/webhook") {
    item = (await plaidClient.updateItemWebhook(creds.access_token,
      "https://us-east4-plaidimportfirebase.cloudfunctions.net/webhook")).item;
  }

  var document = {
    creds: {
      access_token: creds.access_token,
      item_id: creds.item_id
    },
    item: item,
    accounts: accounts.accounts
  }

  var user = db.collection('users').doc(context.auth.uid)
  functions.logger.info(document)

  await db.runTransaction(async (t) => {
    var userData = await t.get(user)
    var items: Array<string> = userData.data()?.items
    if (!items.includes(creds.item_id)) {
      items.push(creds.item_id)
    }
    t.update(user, { items: items })

    t.set(db.collection('items').doc(creds.item_id), document)
  })

  return { code: 200 }

})