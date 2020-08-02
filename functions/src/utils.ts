import * as plaid from 'plaid';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

admin.initializeApp()

export const db = admin.firestore()

export const plaidClient = new plaid.Client({
  clientID: "5e798dce7ba2dd00148a46b7",
  secret: "7aa7a7588a43f3d7617496b347bc19",
  env: plaid.environments.sandbox,
  options: {
    version: '2019-05-29',
  },
});

export const runtimeOpts = {
  timeoutSeconds: 30,
  memory: '128MB' as const
}

export const customFunctions = functions.region('us-east4').runWith(runtimeOpts)
