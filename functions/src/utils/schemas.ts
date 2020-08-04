import * as yup from "yup";

export const webhook = yup.object().shape({
  webhookUrl: yup.string().url().required()
});

export const publicToken = yup.object().shape({
  publicToken: yup.string().required()
});

export const newCheckoutSession = yup.object().shape({
  addons: yup.number().min(0).required()
})