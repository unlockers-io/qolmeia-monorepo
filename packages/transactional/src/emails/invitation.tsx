import { Heading, Link, Text } from "react-email";

import { Button } from "../components/button";
import { Divider } from "../components/divider";

import { BaseLayout } from "./base-layout";

type InvitationEmailProps = {
  acceptUrl: string;
  companyName: string;
  userEmail: string;
};

const InvitationEmail = ({ acceptUrl, companyName, userEmail }: InvitationEmailProps) => {
  return (
    <BaseLayout
      footerText="Você está recebendo este e-mail porque a equipe Qolmeia convidou este endereço."
      preview={`Seu convite para a ${companyName} na Qolmeia`}
    >
      <Heading className="mt-0 mb-4 text-2xl font-semibold tracking-tight text-balance break-words text-foreground">
        Você foi convidado para a Qolmeia
      </Heading>

      <Text className="m-0 mb-6 text-base text-pretty break-words text-muted-foreground">
        A equipe Qolmeia convidou você para acessar o time de agentes da{" "}
        <strong>{companyName}</strong>. Clique no botão abaixo e entre com este e-mail para aceitar.
        O convite expira em 7 dias.
      </Text>

      <div className="mb-6">
        <Button fullWidth href={acceptUrl} variant="primary">
          Aceitar convite
        </Button>
      </div>

      <Divider />

      <Text className="m-0 mb-4 text-sm text-muted-foreground">
        Se você não esperava este convite, pode ignorar este e-mail.
      </Text>

      <Text className="m-0 mb-4 text-sm text-muted-foreground">
        <strong>E-mail convidado</strong>
        <br />
        {userEmail}
      </Text>

      <Divider spacing="sm" />

      <Text className="m-0 text-xs text-muted-foreground">
        Se o botão acima não funcionar, copie e cole este link no seu navegador:
        <br />
        <Link className="break-all text-foreground underline" href={acceptUrl}>
          {acceptUrl}
        </Link>
      </Text>
    </BaseLayout>
  );
};

export { InvitationEmail };
export default InvitationEmail;
