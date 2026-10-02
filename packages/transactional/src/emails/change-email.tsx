import { Heading, Link, Text } from "react-email";

import { Button } from "../components/button";
import { Divider } from "../components/divider";

import { BaseLayout } from "./base-layout";

type ChangeEmailProps = {
  changeUrl: string;
  currentEmail: string;
  newEmail: string;
  username?: string;
};

const ChangeEmail = ({ changeUrl, currentEmail, newEmail, username }: ChangeEmailProps) => {
  return (
    <BaseLayout preview="Confirme o novo e-mail da sua conta Qolmeia.">
      <Heading className="mt-0 mb-4 text-2xl font-semibold tracking-tight text-balance break-words text-foreground">
        Confirme seu novo e-mail
      </Heading>

      <Text className="m-0 mb-6 text-base text-pretty break-words text-muted-foreground">
        Você pediu para trocar o e-mail da sua conta Qolmeia
        {username !== undefined && username !== "" ? ` (${username})` : ""} de{" "}
        <strong>{currentEmail}</strong> para <strong>{newEmail}</strong>. Confirme para concluir a
        troca.
      </Text>

      <div className="mb-6">
        <Button fullWidth href={changeUrl} variant="primary">
          Confirmar novo e-mail
        </Button>
      </div>

      <Divider />

      <Text className="m-0 mb-4 text-sm text-muted-foreground">
        Se você não pediu essa troca, ignore este e-mail: nada muda e sua conta continua com
        {currentEmail}. O link de confirmação expira em 24 horas.
      </Text>

      <Divider spacing="sm" />

      <Text className="m-0 text-xs text-muted-foreground">
        Se o botão acima não funcionar, copie e cole este link no seu navegador:
        <br />
        <Link className="break-all text-foreground underline" href={changeUrl}>
          {changeUrl}
        </Link>
      </Text>
    </BaseLayout>
  );
};

export { ChangeEmail };
export default ChangeEmail;
