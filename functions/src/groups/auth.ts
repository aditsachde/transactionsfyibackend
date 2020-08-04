import * as functions from 'firebase-functions';
import { db, customFunctions } from '../utils/utils'
import Stripe from 'stripe'
const stripe = new Stripe('sk_test_51HBnbiFbBJyOwYq8jes5cpgGTB5GedJ74aGaumOIbZmsDVQzRDWGrbXU9mCZrmZRofnWCQnHCZ9ZHLVmXR6XWfZO00qpHtbfE5', {
  apiVersion: '2020-03-02',
});


exports.newUser = customFunctions.auth.user().onCreate(async (user) => {

    const customer = await stripe.customers.create({ email: user.email })
    const intent = await stripe.setupIntents.create({ customer: customer.id })
  
    const batch = db.batch()
    batch.set(db.collection('users').doc(user.uid), {
      email: user.email,
      displayName: user.displayName,
      items: [],
      webhook: false,
      ifttt: true,
      webhookUrl: "",
      customer_id: customer.id,
      setup_secret: intent.client_secret,
    })
  
    batch.set(db.collection('cubbyhole').doc(user.uid), {})
  
    await batch.commit()
  
    functions.logger.info("New user! ", user.uid)
  })