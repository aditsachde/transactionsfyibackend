
import * as functions from 'firebase-functions';
import { db, plaidClient, runtimeOpts } from './utils'
import { transactionDefaultUpdateInterface } from './types'
import axios from 'axios'

exports.webhooks = functions.runWith(runtimeOpts)
    .firestore.document('webhooks/{documentId}')
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
    var month = (date.getUTCMonth()+1).toString().padStart(2, "0")
    var day = (date.getUTCDate()+1).toString().padStart(2, "0")

    var start = `${year-2}-${month}-${day}`
    var end = `${year}-${month}-${day}`
    console.log(start, " ", end)

    var transactions = await plaidClient.getTransactions(item?.creds.access_token, start, end, {
        count: Math.min(500, webhook.new_transactions)
    })

    functions.logger.info('posting webhook')
    await axios.post(user.webhook_url, transactions)
}