import { z } from "zod";

// Shared validation schemas
export const EmailSchema = z.string().email();
