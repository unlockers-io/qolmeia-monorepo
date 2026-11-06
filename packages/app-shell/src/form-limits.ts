import { z } from "zod";

const formatCount = (count: number): string => count.toLocaleString("pt-BR");

const maxLengthMessage = (max: number): string => `Use no máximo ${formatCount(max)} caracteres.`;

const maxLength = (max: number) => z.string().trim().max(max, maxLengthMessage(max));

const maxLengthHint = (max: number): string => `Até ${formatCount(max)} caracteres.`;

export { formatCount, maxLength, maxLengthHint, maxLengthMessage };
