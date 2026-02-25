import { z } from "zod";
/** Input for GET /v1/listings - fetch all listings in an account */
export declare const GetListingsInputSchema: z.ZodObject<{
    skip_hidden: z.ZodOptional<z.ZodBoolean>;
    only_syncing: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    skip_hidden?: boolean | undefined;
    only_syncing?: boolean | undefined;
}, {
    skip_hidden?: boolean | undefined;
    only_syncing?: boolean | undefined;
}>;
/** Input for GET /v1/listings/{listing_id} - fetch a single listing */
export declare const GetListingInputSchema: z.ZodObject<{
    listing_id: z.ZodString;
    pms: z.ZodString;
}, "strip", z.ZodTypeAny, {
    pms: string;
    listing_id: string;
}, {
    pms: string;
    listing_id: string;
}>;
/** A single listing update entry within the UpdateListings request */
export declare const ListingUpdateEntrySchema: z.ZodObject<{
    id: z.ZodString;
    pms: z.ZodString;
    min: z.ZodOptional<z.ZodNumber>;
    base: z.ZodOptional<z.ZodNumber>;
    max: z.ZodOptional<z.ZodNumber>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    pms: string;
    min?: number | undefined;
    base?: number | undefined;
    max?: number | undefined;
    tags?: string[] | undefined;
}, {
    id: string;
    pms: string;
    min?: number | undefined;
    base?: number | undefined;
    max?: number | undefined;
    tags?: string[] | undefined;
}>;
/**
 * Input for POST /v1/listings - update one or more listings.
 * Locked decision: write tools require a reason parameter for audit trail.
 */
export declare const UpdateListingsInputSchema: z.ZodObject<{
    listings: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        pms: z.ZodString;
        min: z.ZodOptional<z.ZodNumber>;
        base: z.ZodOptional<z.ZodNumber>;
        max: z.ZodOptional<z.ZodNumber>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        pms: string;
        min?: number | undefined;
        base?: number | undefined;
        max?: number | undefined;
        tags?: string[] | undefined;
    }, {
        id: string;
        pms: string;
        min?: number | undefined;
        base?: number | undefined;
        max?: number | undefined;
        tags?: string[] | undefined;
    }>, "many">;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    listings: {
        id: string;
        pms: string;
        min?: number | undefined;
        base?: number | undefined;
        max?: number | undefined;
        tags?: string[] | undefined;
    }[];
}, {
    reason: string;
    listings: {
        id: string;
        pms: string;
        min?: number | undefined;
        base?: number | undefined;
        max?: number | undefined;
        tags?: string[] | undefined;
    }[];
}>;
/** Input for POST /v1/add_listing_data - import a newly added listing from PMS */
export declare const AddListingInputSchema: z.ZodObject<{
    listing_id: z.ZodString;
    pms_name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    listing_id: string;
    pms_name: string;
}, {
    listing_id: string;
    pms_name: string;
}>;
