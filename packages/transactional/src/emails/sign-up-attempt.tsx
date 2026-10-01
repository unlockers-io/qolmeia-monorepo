import { Heading, Link, Text } from "react-email";

import { Button } from "../components/button";
import { Card } from "../components/card";
import { Divider } from "../components/divider";

import { BaseLayout } from "./base-layout";

type SignUpAttemptEmailProps = {
  resetPasswordUrl: string;
  signInUrl: string;
  userEmail: string;
  username?: string;
};

const SignUpAttemptEmail = ({
  resetPasswordUrl,
  signInUrl,
  userEmail,
  username,
}: SignUpAttemptEmailProps) => {
  return (
    <BaseLayout preview="Alguém tentou criar uma conta Qolmeia com o seu e-mail">
      <Heading className="mt-0 mb-4 text-2xl font-semibold tracking-tight text-balance break-words text-foreground">
        Você tentou criar uma conta?
      </Heading>

      <Text className="m-0 mb-2 text-base text-pretty break-words text-muted-foreground">
        Olá{username !== undefined && username !== "" ? ` ${username}` : ""},
      </Text>

      <Text className="m-0 mb-2 text-base text-pretty break-words text-muted-foreground">
        Alguém tentou criar uma conta Qolmeia com o seu e-mail (<strong>{userEmail}</strong>). Você
        já tem uma conta, então nenhuma conta nova foi criada.
      </Text>

      <Text className="m-0 mb-6 text-base text-pretty break-words text-muted-foreground">
        Se foi você, entre na sua conta pelo botão abaixo. Se esqueceu a senha, é possível
        redefini-la.
      </Text>

      <div className="mb-6">
        <Button fullWidth href={signInUrl} variant="primary">
          Entrar
        </Button>
      </div>

      <Text className="m-0 mb-6 text-base text-muted-foreground">
        Ou{" "}
        <Link className="text-foreground underline" href={resetPasswordUrl}>
          redefina sua senha
        </Link>{" "}
        se não lembrar dela.
      </Text>

      <Divider />

      <Card accent title="Não foi você?">
        <Text className="m-0 mb-2 text-base text-muted-foreground">
          Pode ignorar este e-mail: nada mudou na sua conta. Se esses avisos continuarem chegando,
          alguém pode estar testando contas com o seu e-mail. Recomendamos:
        </Text>
        <ul className="m-0 list-inside list-disc text-base text-muted-foreground">
          <li className="py-1">Verificar se a sua conta de e-mail está segura</li>
          <li className="py-1">
            <Link className="text-foreground underline" href="mailto:security@qolmeia.com">
              Avisar nosso time de segurança
            </Link>
          </li>
        </ul>
      </Card>

      <Divider spacing="sm" />

      <Text className="m-0 text-xs text-muted-foreground">
        Se o botão acima não funcionar, copie e cole este link no seu navegador:
        <br />
        <Link className="break-all text-foreground underline" href={signInUrl}>
          {signInUrl}
        </Link>
      </Text>
    </BaseLayout>
  );
};

export { SignUpAttemptEmail };
export default SignUpAttemptEmail;
