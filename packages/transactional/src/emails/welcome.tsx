import { Heading, Link, Text } from "react-email";

import { Button } from "../components/button";
import { Divider } from "../components/divider";

import { BaseLayout } from "./base-layout";

type WelcomeEmailProps = {
  userEmail: string;
  username?: string;
  verificationUrl: string;
};

const WelcomeEmail = ({ userEmail, username, verificationUrl }: WelcomeEmailProps) => {
  return (
    <BaseLayout preview="Boas-vindas à Qolmeia. Confirme seu e-mail para começar.">
      <Heading className="mt-0 mb-4 text-2xl font-semibold tracking-tight text-balance break-words text-foreground">
        Boas-vindas à Qolmeia.
      </Heading>

      <Text className="m-0 mb-6 text-base text-pretty break-words text-muted-foreground">
        Que bom ter você aqui. Confirme seu e-mail para terminar de configurar sua conta.
      </Text>

      <div className="mb-6">
        <Button fullWidth href={verificationUrl} variant="primary">
          Confirmar e-mail
        </Button>
      </div>

      <Divider />

      <Text className="m-0 mb-4 text-sm text-muted-foreground">
        Se você não criou uma conta na Qolmeia, pode ignorar este e-mail. O link de confirmação
        expira em 24 horas.
      </Text>

      <Text className="m-0 mb-4 text-sm text-muted-foreground">
        <strong>Detalhes da conta</strong>
        <br />
        {username !== undefined && username !== "" ? (
          <>
            Usuário: {username}
            <br />
          </>
        ) : null}
        E-mail: {userEmail}
      </Text>

      <Divider spacing="sm" />

      <Text className="m-0 text-xs text-muted-foreground">
        Se o botão acima não funcionar, copie e cole este link no seu navegador:
        <br />
        <Link className="break-all text-foreground underline" href={verificationUrl}>
          {verificationUrl}
        </Link>
      </Text>
    </BaseLayout>
  );
};

export { WelcomeEmail };
export default WelcomeEmail;
