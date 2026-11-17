import * as React from "react";

import { ChangeEmail } from "../emails/change-email";
import { InvitationEmail } from "../emails/invitation";
import { MagicLinkEmail } from "../emails/magic-link";
import { PasswordResetEmail } from "../emails/password-reset";
import { SignUpAttemptEmail } from "../emails/sign-up-attempt";
import { WelcomeEmail } from "../emails/welcome";
import type { Transport } from "../transport";

import { sendEmail } from "./send-email";

type WelcomePayload = {
  expiresInSeconds: number;
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
  expiresInSeconds: number;
  resetUrl: string;
  userEmail: string;
  userId: string;
  username?: string;
};

type ChangeEmailPayload = {
  changeUrl: string;
  currentEmail: string;
  expiresInSeconds: number;
  newEmail: string;
  userId: string;
  username?: string;
};

type MagicLinkPayload = {
  expiresInSeconds: number;
  url: string;
  userEmail: string;
  userId?: string;
  username?: string;
};

type InvitationPayload = {
  acceptUrl: string;
  companyName: string;
  expiresInSeconds: number;
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

type TemplateBuilder<P> = (payload: P, year: number) => EmailBuild;

type TemplateRegistry = { [Type in EmailType]: TemplateBuilder<PayloadByType[Type]> };

const TEMPLATES: TemplateRegistry = {
  "change-email-confirmation": (
    { changeUrl, currentEmail, expiresInSeconds, newEmail, username }: ChangeEmailPayload,
    year: number,
  ) => ({
    subject: "Confirme a troca de e-mail da sua conta Qolmeia",
    template: React.createElement(ChangeEmail, {
      changeUrl,
      currentEmail,
      expiresInSeconds,
      newEmail,
      username,
      year,
    }),
    to: currentEmail,
  }),
  invitation: (
    { acceptUrl, companyName, expiresInSeconds, userEmail }: InvitationPayload,
    year: number,
  ) => ({
    subject: `Seu convite para a ${companyName} na Qolmeia`,
    template: React.createElement(InvitationEmail, {
      acceptUrl,
      companyName,
      expiresInSeconds,
      userEmail,
      year,
    }),
    to: userEmail,
  }),
  "magic-link": (
    { expiresInSeconds, url, userEmail, username }: MagicLinkPayload,
    year: number,
  ) => ({
    subject: "Seu link de acesso à Qolmeia",
    template: React.createElement(MagicLinkEmail, {
      expiresInSeconds,
      url,
      userEmail,
      username,
      year,
    }),
    to: userEmail,
  }),
  "password-reset": (
    { expiresInSeconds, resetUrl, userEmail, username }: PasswordResetPayload,
    year: number,
  ) => ({
    subject: "Redefina sua senha da Qolmeia",
    template: React.createElement(PasswordResetEmail, {
      expiresInSeconds,
      resetUrl,
      userEmail,
      username,
      year,
    }),
    to: userEmail,
  }),
  "sign-up-attempt": (
    { resetPasswordUrl, signInUrl, userEmail, username }: SignUpAttemptPayload,
    year: number,
  ) => ({
    subject: "Tentativa de cadastro com o seu e-mail na Qolmeia",
    template: React.createElement(SignUpAttemptEmail, {
      resetPasswordUrl,
      signInUrl,
      userEmail,
      username,
      year,
    }),
    to: userEmail,
  }),
  welcome: (
    { expiresInSeconds, userEmail, username, verificationUrl }: WelcomePayload,
    year: number,
  ) => ({
    subject: `Boas-vindas à Qolmeia${username !== undefined && username !== "" ? `, ${username}` : ""}! Confirme seu e-mail`,
    template: React.createElement(WelcomeEmail, {
      expiresInSeconds,
      userEmail,
      username,
      verificationUrl,
      year,
    }),
    to: userEmail,
  }),
};

const buildEmail = <Type extends EmailType>(
  type: Type,
  payload: PayloadByType[Type],
  year: number,
): EmailBuild => TEMPLATES[type](payload, year);

const sendTransactionalEmail = (email: TransactionalEmail, transport: Transport) => {
  const { subject, template, to } = buildEmail(email.type, email, new Date().getFullYear());

  return sendEmail({
    subject,
    tags: [
      { name: "type", value: email.type },
      ...(email.userId !== undefined && email.userId !== ""
        ? [{ name: "userId", value: email.userId }]
        : []),
    ],
    template,
    to,
    transport,
  });
};

export { sendTransactionalEmail };
