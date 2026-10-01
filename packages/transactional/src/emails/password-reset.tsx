import { Heading, Link, Text } from "react-email";

import { Button } from "../components/button";
import { Card } from "../components/card";
import { Divider } from "../components/divider";

import { BaseLayout } from "./base-layout";

type PasswordResetEmailProps = {
  browserInfo?: string;
  ipAddress?: string;
  resetUrl: string;
  userEmail: string;
  username?: string;
};

const PasswordResetEmail = ({
  browserInfo,
  ipAddress,
  resetUrl,
  userEmail,
  username,
}: PasswordResetEmailProps) => {
  return (
    <BaseLayout preview="Redefina sua senha da Qolmeia">
      <Heading className="mt-0 mb-4 text-2xl font-semibold tracking-tight text-balance break-words text-foreground">
        Redefina sua senha
      </Heading>

      <Text className="m-0 mb-2 text-base text-pretty break-words text-muted-foreground">
        Olá{username !== undefined && username !== "" ? ` ${username}` : ""},
      </Text>

      <Text className="m-0 mb-6 text-base text-pretty break-words text-muted-foreground">
        Recebemos um pedido para redefinir a senha da sua conta Qolmeia. Se foi você, use o botão
        abaixo para criar uma nova senha.
      </Text>

      <div className="mb-6">
        <Button fullWidth href={resetUrl} variant="primary">
          Redefinir senha
        </Button>
      </div>

      <Divider />

      <Card accent title="Detalhes do pedido">
        <ul className="m-0 list-none p-0 text-base text-muted-foreground">
          <li className="py-1">E-mail: {userEmail}</li>
          {ipAddress !== undefined && ipAddress !== "" && (
            <li className="py-1">Endereço IP: {ipAddress}</li>
          )}
          {browserInfo !== undefined && browserInfo !== "" && (
            <li className="py-1">Navegador: {browserInfo}</li>
          )}
        </ul>
        <Text className="m-0 mt-3 mb-2 text-base font-semibold text-foreground">Importante</Text>
        <ul className="m-0 list-inside list-disc text-base text-muted-foreground">
          <li className="py-1">O link expira em 1 hora</li>
          <li className="py-1">Ele só pode ser usado uma vez</li>
          <li className="py-1">Se você não fez este pedido, proteja sua conta</li>
        </ul>
      </Card>

      <Divider spacing="sm" />

      <Text className="m-0 text-xs text-muted-foreground">
        Se o botão acima não funcionar, copie e cole este link no seu navegador:
        <br />
        <Link className="break-all text-foreground underline" href={resetUrl}>
          {resetUrl}
        </Link>
      </Text>
    </BaseLayout>
  );
};

export { PasswordResetEmail };
export default PasswordResetEmail;
