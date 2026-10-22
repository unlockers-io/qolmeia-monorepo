import * as React from "react";

import { ChangeEmail } from "../emails/change-email";
import { InvitationEmail } from "../emails/invitation";
import { MagicLinkEmail } from "../emails/magic-link";
import { PasswordResetEmail } from "../emails/password-reset";
import { SignUpAttemptEmail } from "../emails/sign-up-attempt";
import { WelcomeEmail } from "../emails/welcome";

import { sendEmail } from "./send-email";

type SendEmail = typeof sendEmail;

type MailerConfig = {
  apiKey: string;
  defaultReplyTo?: string;
  from?: string;
};

const DEFAULT_FROM = "Qolmeia <noreply@email.qolmeia.com>";

type WelcomePayload = {
  userEmail: string;
  userId: string;
  username?: string;
  verificationUrl: string;
};

type SignUpAttemptPayload = {
  resetPasswordUrl: string;
  signInUrl: string;
  userEmail: string;
  userId: string;
  username?: string;
};

type PasswordResetPayload = {
  browserInfo?: string;
  ipAddress?: string;
  resetUrl: string;
  userEmail: string;
  userId: string;
  username?: string;
};

type ChangeEmailPayload = {
  changeUrl: string;
  currentEmail: string;
  newEmail: string;
  userId: string;
  username?: string;
};

type MagicLinkPayload = {
  url: string;
  userEmail: string;
  userId?: string;
  username?: string;
};

type InvitationPayload = {
  acceptUrl: string;
  companyName: string;
  userEmail: string;
  userId?: string;
};

type PayloadByType = {
  "change-email-confirmation": ChangeEmailPayload;
  invitation: InvitationPayload;
  "magic-link": MagicLinkPayload;
  "password-reset": PasswordResetPayload;
  "sign-up-attempt": SignUpAttemptPayload;
  welcome: WelcomePayload;
};

type EmailType = keyof PayloadByType;

type TransactionalEmail = {
  [Type in EmailType]: { type: Type } & PayloadByType[Type];
}[EmailType];

type EmailBuild = { subject: string; template: React.ReactElement; to: string };

type TemplateBuilder<P> = (payload: P) => EmailBuild;

type TemplateRegistry = { [Type in EmailType]: TemplateBuilder<PayloadByType[Type]> };

const TEMPLATES: TemplateRegistry = {
  "change-email-confirmation": ({
    changeUrl,
    currentEmail,
    newEmail,
    username,
  }: ChangeEmailPayload) => ({
    subject: "Confirme a troca de e-mail da sua conta Qolmeia",
    template: React.createElement(ChangeEmail, { changeUrl, currentEmail, newEmail, username }),
    to: currentEmail,
  }),
  invitation: ({ acceptUrl, companyName, userEmail }: InvitationPayload) => ({
    subject: `Seu convite para a ${companyName} na Qolmeia`,
    template: React.createElement(InvitationEmail, { acceptUrl, companyName, userEmail }),
    to: userEmail,
  }),
  "magic-link": ({ url, userEmail, username }: MagicLinkPayload) => ({
    subject: "Seu link de acesso à Qolmeia",
    template: React.createElement(MagicLinkEmail, { url, userEmail, username }),
    to: userEmail,
  }),
  "password-reset": ({
    browserInfo,
    ipAddress,
    resetUrl,
    userEmail,
    username,
  }: PasswordResetPayload) => ({
    subject: "Redefina sua senha da Qolmeia",
    template: React.createElement(PasswordResetEmail, {
      browserInfo,
      ipAddress,
      resetUrl,
      userEmail,
      username,
    }),
    to: userEmail,
  }),
  "sign-up-attempt": ({
    resetPasswordUrl,
    signInUrl,
    userEmail,
    username,
  }: SignUpAttemptPayload) => ({
    subject: "Tentativa de cadastro com o seu e-mail na Qolmeia",
    template: React.createElement(SignUpAttemptEmail, {
      resetPasswordUrl,
      signInUrl,
      userEmail,
      username,
    }),
    to: userEmail,
  }),
  welcome: ({ userEmail, username, verificationUrl }: WelcomePayload) => ({
    subject: `Boas-vindas à Qolmeia${username !== undefined && username !== "" ? `, ${username}` : ""}! Confirme seu e-mail`,
    template: React.createElement(WelcomeEmail, { userEmail, username, verificationUrl }),
    to: userEmail,
  }),
};

const buildEmail = <Type extends EmailType>(type: Type, payload: PayloadByType[Type]): EmailBuild =>
  TEMPLATES[type](payload);

const createTransactionalEmailSender =
  (send: SendEmail) => (email: TransactionalEmail, config: MailerConfig) => {
    const { subject, template, to } = buildEmail(email.type, email);

    return send({
      apiKey: config.apiKey,
      defaultReplyTo: config.defaultReplyTo,
      from: config.from !== undefined && config.from !== "" ? config.from : DEFAULT_FROM,
      subject,
      tags: [
        { name: "type", value: email.type },
        ...(email.userId !== undefined && email.userId !== ""
          ? [{ name: "userId", value: email.userId }]
          : []),
      ],
      template,
      to,
    });
  };

const sendTransactionalEmail = createTransactionalEmailSender(sendEmail);

export type { MailerConfig, TransactionalEmail };

export { createTransactionalEmailSender, sendTransactionalEmail };
