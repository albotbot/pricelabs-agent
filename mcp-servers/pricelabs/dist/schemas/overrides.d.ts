import { z } from "zod";
/** Input for GET /v1/listings/{listing_id}/overrides - fetch DSOs for a listing */
export declare const GetOverridesInputSchema: z.ZodObject<{
    listing_id: z.ZodString;
    pms: z.ZodString;
    start_date: z.ZodOptional<z.ZodString>;
    end_date: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    pms: string;
    listing_id: string;
    start_date?: string | undefined;
    end_date?: string | undefined;
}, {
    pms: string;
    listing_id: string;
    start_date?: string | undefined;
    end_date?: string | undefined;
}>;
/** A single date-specific override entry for the SetOverrides request */
export declare const OverrideWriteEntrySchema: z.ZodEffects<z.ZodObject<{
    date: z.ZodString;
    price_type: z.ZodEnum<["fixed", "percentage"]>;
    price_value: z.ZodNumber;
    currency: z.ZodOptional<z.ZodString>;
    min_stay: z.ZodOptional<z.ZodNumber>;
    check_in: z.ZodOptional<z.ZodString>;
    check_out: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    date: string;
    price_type: "fixed" | "percentage";
    price_value: number;
    currency?: string | undefined;
    min_stay?: number | undefined;
    check_in?: string | undefined;
    check_out?: string | undefined;
}, {
    date: string;
    price_type: "fixed" | "percentage";
    price_value: number;
    currency?: string | undefined;
    min_stay?: number | undefined;
    check_in?: string | undefined;
    check_out?: string | undefined;
}>, {
    date: string;
    price_type: "fixed" | "percentage";
    price_value: number;
    currency?: string | undefined;
    min_stay?: number | undefined;
    check_in?: string | undefined;
    check_out?: string | undefined;
}, {
    date: string;
    price_type: "fixed" | "percentage";
    price_value: number;
    currency?: string | undefined;
    min_stay?: number | undefined;
    check_in?: string | undefined;
    check_out?: string | undefined;
}>;
/**
 * Input for POST /v1/listings/{listing_id}/overrides - set date-specific overrides.
 * Locked decision: write tools require a reason parameter for audit trail.
 * DSO validation enforces: percentage range -75 to 500, currency required for fixed.
 */
export declare const SetOverridesInputSchema: z.ZodObject<{
    listing_id: z.ZodString;
    pms: z.ZodString;
    overrides: z.ZodArray<z.ZodEffects<z.ZodObject<{
        date: z.ZodString;
        price_type: z.ZodEnum<["fixed", "percentage"]>;
        price_value: z.ZodNumber;
        currency: z.ZodOptional<z.ZodString>;
        min_stay: z.ZodOptional<z.ZodNumber>;
        check_in: z.ZodOptional<z.ZodString>;
        check_out: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        date: string;
        price_type: "fixed" | "percentage";
        price_value: number;
        currency?: string | undefined;
        min_stay?: number | undefined;
        check_in?: string | undefined;
        check_out?: string | undefined;
    }, {
        date: string;
        price_type: "fixed" | "percentage";
        price_value: number;
        currency?: string | undefined;
        min_stay?: number | undefined;
        check_in?: string | undefined;
        check_out?: string | undefined;
    }>, {
        date: string;
        price_type: "fixed" | "percentage";
        price_value: number;
        currency?: string | undefined;
        min_stay?: number | undefined;
        check_in?: string | undefined;
        check_out?: string | undefined;
    }, {
        date: string;
        price_type: "fixed" | "percentage";
        price_value: number;
        currency?: string | undefined;
        min_stay?: number | undefined;
        check_in?: string | undefined;
        check_out?: string | undefined;
    }>, "many">;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    pms: string;
    reason: string;
    listing_id: string;
    overrides: {
        date: string;
        price_type: "fixed" | "percentage";
        price_value: number;
        currency?: string | undefined;
        min_stay?: number | undefined;
        check_in?: string | undefined;
        check_out?: string | undefined;
    }[];
}, {
    pms: string;
    reason: string;
    listing_id: string;
    overrides: {
        date: string;
        price_type: "fixed" | "percentage";
        price_value: number;
        currency?: string | undefined;
        min_stay?: number | undefined;
        check_in?: string | undefined;
        check_out?: string | undefined;
    }[];
}>;
/**
 * Input for DELETE /v1/listings/{listing_id}/overrides - remove date-specific overrides.
 * Locked decision: write tools require a reason parameter for audit trail.
 */
export declare const DeleteOverridesInputSchema: z.ZodObject<{
    listing_id: z.ZodString;
    pms: z.ZodString;
    dates: z.ZodArray<z.ZodString, "many">;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    pms: string;
    reason: string;
    listing_id: string;
    dates: string[];
}, {
    pms: string;
    reason: string;
    listing_id: string;
    dates: string[];
}>;
