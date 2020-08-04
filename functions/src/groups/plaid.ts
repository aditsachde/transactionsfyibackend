import * as functions from 'firebase-functions';
import { db, plaidClient, customFunctions } from '../utils/utils'
import { transactionDefaultUpdateInterface } from '../utils/types'
import axios from 'axios'

exports.webhook = customFunctions.https.onRequest(async (req, res) => {
    await db.collection('plaidhook').add(req.body)
    res.status(200)
})

exports.processWebhook = customFunctions
    .firestore.document('plaidhook/{documentId}')
    .onCreate(async (snap, context) => {
        var webhook = snap.data()
        if (webhook.webhook_type === "TRANSACTIONS") {
            switch (webhook.webhook_code) {
                case "DEFAULT_UPDATE":
                    await transactionDefaultUpdate(webhook as transactionDefaultUpdateInterface)
                    functions.logger.info('running default update')
                    break
            }
        }
    })

var transactionDefaultUpdate = async (webhook: transactionDefaultUpdateInterface) => {
    const user = (await db.collection('users').where('items', 'array-contains', webhook.item_id).get()).docs[0].data()
    const item = (await db.collection('items').doc(webhook.item_id).get()).data()

    var date = new Date()
    var year = date.getUTCFullYear()
    var month = (date.getUTCMonth() + 1).toString().padStart(2, "0")
    var day = (date.getUTCDate() + 1).toString().padStart(2, "0")

    var start = `${year - 2}-${month}-${day}`
    var end = `${year}-${month}-${day}`
    console.log(start, " ", end)

    var transactions = await plaidClient.getTransactions(item?.creds.access_token, start, end, {
        count: Math.min(500, webhook.new_transactions)
    })

    functions.logger.info('posting webhook')
    await axios.post(user.webhookUrl, transactions)
}