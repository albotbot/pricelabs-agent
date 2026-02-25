import { z } from "zod";
/** PriceLabs listing ID */
export declare const ListingIdSchema: z.ZodString;
/** PMS name identifier (e.g., "airbnb", "vrbo", "rentalsunited") */
export declare const PmsNameSchema: z.ZodString;
/** Date string in YYYY-MM-DD format */
export declare const DateStringSchema: z.ZodString;
/**
 * Check-in/check-out day-of-week binary string.
 * 7-character string where each character is '0' or '1' representing Mon-Sun.
 * Example: "1111100" means Mon-Fri allowed, Sat-Sun not allowed.
 */
export declare const CheckInOutSchema: z.ZodString;
/** Metadata included in every tool response */
export declare const ResponseMetaSchema: z.ZodObject<{
    cache_age_seconds: z.ZodNumber;
    data_source: z.ZodEnum<["live", "cached"]>;
    api_calls_remaining: z.ZodNumber;
    fetched_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    cache_age_seconds: number;
    data_source: "live" | "cached";
    api_calls_remaining: number;
    fetched_at: string;
}, {
    cache_age_seconds: number;
    data_source: "live" | "cached";
    api_calls_remaining: number;
    fetched_at: string;
}>;
/**
 * Generic tool response envelope.
 * Every tool response wraps raw API data with computed fields and metadata.
 * This enforces the locked decision that every response includes cache_age_seconds and data_source.
 */
export declare function ToolResponseSchema<T extends z.ZodTypeAny>(dataSchema: T): z.ZodObject<{
    data: T;
    computed: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    meta: z.ZodObject<{
        cache_age_seconds: z.ZodNumber;
        data_source: z.ZodEnum<["live", "cached"]>;
        api_calls_remaining: z.ZodNumber;
        fetched_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        cache_age_seconds: number;
        data_source: "live" | "cached";
        api_calls_remaining: number;
        fetched_at: string;
    }, {
        cache_age_seconds: number;
        data_source: "live" | "cached";
        api_calls_remaining: number;
        fetched_at: string;
    }>;
}, "strip", z.ZodTypeAny, z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{
    data: T;
    computed: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    meta: z.ZodObject<{
        cache_age_seconds: z.ZodNumber;
        data_source: z.ZodEnum<["live", "cached"]>;
        api_calls_remaining: z.ZodNumber;
        fetched_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        cache_age_seconds: number;
        data_source: "live" | "cached";
        api_calls_remaining: number;
        fetched_at: string;
    }, {
        cache_age_seconds: number;
        data_source: "live" | "cached";
        api_calls_remaining: number;
        fetched_at: string;
    }>;
}>, any> extends infer T_1 ? { [k in keyof T_1]: T_1[k]; } : never, z.baseObjectInputType<{
    data: T;
    computed: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    meta: z.ZodObject<{
        cache_age_seconds: z.ZodNumber;
        data_source: z.ZodEnum<["live", "cached"]>;
        api_calls_remaining: z.ZodNumber;
        fetched_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        cache_age_seconds: number;
        data_source: "live" | "cached";
        api_calls_remaining: number;
        fetched_at: string;
    }, {
        cache_age_seconds: number;
        data_source: "live" | "cached";
        api_calls_remaining: number;
        fetched_at: string;
    }>;
}> extends infer T_2 ? { [k_1 in keyof T_2]: T_2[k_1]; } : never>;
export declare const ListingResponseSchema: z.ZodObject<{
    id: z.ZodString;
    pms: z.ZodString;
    name: z.ZodString;
    latitude: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    longitude: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    city_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    state: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    no_of_bedrooms: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    min: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    base: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    max: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
    group: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    subgroup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isHidden: z.ZodOptional<z.ZodBoolean>;
    push_enabled: z.ZodOptional<z.ZodBoolean>;
    occupancy_next_7: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    occupancy_next_30: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    occupancy_next_60: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    occupancy_next_90: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    market_occupancy_next_7: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    market_occupancy_next_30: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    market_occupancy_next_60: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    market_occupancy_next_90: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    revenue_past_7: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    stly_revenue_past_7: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    recommended_base_price: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    last_date_pushed: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    last_refreshed_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    health_7_day: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    health_30_day: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    health_60_day: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    currency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    pms: string;
    name: string;
    latitude?: number | null | undefined;
    longitude?: number | null | undefined;
    country?: string | null | undefined;
    city_name?: string | null | undefined;
    state?: string | null | undefined;
    no_of_bedrooms?: number | null | undefined;
    min?: number | null | undefined;
    base?: number | null | undefined;
    max?: unknown;
    group?: string | null | undefined;
    subgroup?: string | null | undefined;
    tags?: string[] | undefined;
    notes?: string | null | undefined;
    isHidden?: boolean | undefined;
    push_enabled?: boolean | undefined;
    occupancy_next_7?: number | null | undefined;
    occupancy_next_30?: number | null | undefined;
    occupancy_next_60?: number | null | undefined;
    occupancy_next_90?: number | null | undefined;
    market_occupancy_next_7?: number | null | undefined;
    market_occupancy_next_30?: number | null | undefined;
    market_occupancy_next_60?: number | null | undefined;
    market_occupancy_next_90?: number | null | undefined;
    revenue_past_7?: number | null | undefined;
    stly_revenue_past_7?: number | null | undefined;
    recommended_base_price?: string | null | undefined;
    last_date_pushed?: string | null | undefined;
    last_refreshed_at?: string | null | undefined;
    health_7_day?: string | null | undefined;
    health_30_day?: string | null | undefined;
    health_60_day?: string | null | undefined;
    currency?: string | null | undefined;
}, {
    id: string;
    pms: string;
    name: string;
    latitude?: number | null | undefined;
    longitude?: number | null | undefined;
    country?: string | null | undefined;
    city_name?: string | null | undefined;
    state?: string | null | undefined;
    no_of_bedrooms?: number | null | undefined;
    min?: number | null | undefined;
    base?: number | null | undefined;
    max?: unknown;
    group?: string | null | undefined;
    subgroup?: string | null | undefined;
    tags?: string[] | undefined;
    notes?: string | null | undefined;
    isHidden?: boolean | undefined;
    push_enabled?: boolean | undefined;
    occupancy_next_7?: number | null | undefined;
    occupancy_next_30?: number | null | undefined;
    occupancy_next_60?: number | null | undefined;
    occupancy_next_90?: number | null | undefined;
    market_occupancy_next_7?: number | null | undefined;
    market_occupancy_next_30?: number | null | undefined;
    market_occupancy_next_60?: number | null | undefined;
    market_occupancy_next_90?: number | null | undefined;
    revenue_past_7?: number | null | undefined;
    stly_revenue_past_7?: number | null | undefined;
    recommended_base_price?: string | null | undefined;
    last_date_pushed?: string | null | undefined;
    last_refreshed_at?: string | null | undefined;
    health_7_day?: string | null | undefined;
    health_30_day?: string | null | undefined;
    health_60_day?: string | null | undefined;
    currency?: string | null | undefined;
}>;
export declare const PriceEntrySchema: z.ZodObject<{
    date: z.ZodString;
    price: z.ZodNumber;
    user_price: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    uncustomized_price: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    min_stay: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    booking_status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    booking_status_STLY: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    ADR: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    ADR_STLY: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    unbookable: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodNumber]>>>;
    weekly_discount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    monthly_discount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    extra_person_fee: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    extra_person_fee_trigger: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    check_in: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    check_out: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    demand_color: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    demand_desc: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    booked_date: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    booked_date_STLY: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reason: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, "strip", z.ZodTypeAny, {
    date: string;
    price: number;
    user_price?: number | null | undefined;
    uncustomized_price?: number | null | undefined;
    min_stay?: number | null | undefined;
    booking_status?: string | null | undefined;
    booking_status_STLY?: string | null | undefined;
    ADR?: number | null | undefined;
    ADR_STLY?: number | null | undefined;
    unbookable?: string | number | null | undefined;
    weekly_discount?: number | null | undefined;
    monthly_discount?: number | null | undefined;
    extra_person_fee?: number | null | undefined;
    extra_person_fee_trigger?: number | null | undefined;
    check_in?: boolean | null | undefined;
    check_out?: boolean | null | undefined;
    demand_color?: string | null | undefined;
    demand_desc?: string | null | undefined;
    booked_date?: string | null | undefined;
    booked_date_STLY?: string | null | undefined;
    reason?: Record<string, unknown> | null | undefined;
}, {
    date: string;
    price: number;
    user_price?: number | null | undefined;
    uncustomized_price?: number | null | undefined;
    min_stay?: number | null | undefined;
    booking_status?: string | null | undefined;
    booking_status_STLY?: string | null | undefined;
    ADR?: number | null | undefined;
    ADR_STLY?: number | null | undefined;
    unbookable?: string | number | null | undefined;
    weekly_discount?: number | null | undefined;
    monthly_discount?: number | null | undefined;
    extra_person_fee?: number | null | undefined;
    extra_person_fee_trigger?: number | null | undefined;
    check_in?: boolean | null | undefined;
    check_out?: boolean | null | undefined;
    demand_color?: string | null | undefined;
    demand_desc?: string | null | undefined;
    booked_date?: string | null | undefined;
    booked_date_STLY?: string | null | undefined;
    reason?: Record<string, unknown> | null | undefined;
}>;
export declare const PricesResponseSchema: z.ZodObject<{
    id: z.ZodString;
    pms: z.ZodString;
    group: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    currency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    last_refreshed_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    los_pricing: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    data: z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        price: z.ZodNumber;
        user_price: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        uncustomized_price: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        min_stay: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        booking_status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        booking_status_STLY: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        ADR: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        ADR_STLY: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        unbookable: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodNumber]>>>;
        weekly_discount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        monthly_discount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        extra_person_fee: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        extra_person_fee_trigger: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        check_in: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        check_out: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        demand_color: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        demand_desc: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        booked_date: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        booked_date_STLY: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reason: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, "strip", z.ZodTypeAny, {
        date: string;
        price: number;
        user_price?: number | null | undefined;
        uncustomized_price?: number | null | undefined;
        min_stay?: number | null | undefined;
        booking_status?: string | null | undefined;
        booking_status_STLY?: string | null | undefined;
        ADR?: number | null | undefined;
        ADR_STLY?: number | null | undefined;
        unbookable?: string | number | null | undefined;
        weekly_discount?: number | null | undefined;
        monthly_discount?: number | null | undefined;
        extra_person_fee?: number | null | undefined;
        extra_person_fee_trigger?: number | null | undefined;
        check_in?: boolean | null | undefined;
        check_out?: boolean | null | undefined;
        demand_color?: string | null | undefined;
        demand_desc?: string | null | undefined;
        booked_date?: string | null | undefined;
        booked_date_STLY?: string | null | undefined;
        reason?: Record<string, unknown> | null | undefined;
    }, {
        date: string;
        price: number;
        user_price?: number | null | undefined;
        uncustomized_price?: number | null | undefined;
        min_stay?: number | null | undefined;
        booking_status?: string | null | undefined;
        booking_status_STLY?: string | null | undefined;
        ADR?: number | null | undefined;
        ADR_STLY?: number | null | undefined;
        unbookable?: string | number | null | undefined;
        weekly_discount?: number | null | undefined;
        monthly_discount?: number | null | undefined;
        extra_person_fee?: number | null | undefined;
        extra_person_fee_trigger?: number | null | undefined;
        check_in?: boolean | null | undefined;
        check_out?: boolean | null | undefined;
        demand_color?: string | null | undefined;
        demand_desc?: string | null | undefined;
        booked_date?: string | null | undefined;
        booked_date_STLY?: string | null | undefined;
        reason?: Record<string, unknown> | null | undefined;
    }>, "many">;
    status: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    data: {
        date: string;
        price: number;
        user_price?: number | null | undefined;
        uncustomized_price?: number | null | undefined;
        min_stay?: number | null | undefined;
        booking_status?: string | null | undefined;
        booking_status_STLY?: string | null | undefined;
        ADR?: number | null | undefined;
        ADR_STLY?: number | null | undefined;
        unbookable?: string | number | null | undefined;
        weekly_discount?: number | null | undefined;
        monthly_discount?: number | null | undefined;
        extra_person_fee?: number | null | undefined;
        extra_person_fee_trigger?: number | null | undefined;
        check_in?: boolean | null | undefined;
        check_out?: boolean | null | undefined;
        demand_color?: string | null | undefined;
        demand_desc?: string | null | undefined;
        booked_date?: string | null | undefined;
        booked_date_STLY?: string | null | undefined;
        reason?: Record<string, unknown> | null | undefined;
    }[];
    id: string;
    pms: string;
    status?: string | undefined;
    group?: string | null | undefined;
    last_refreshed_at?: string | null | undefined;
    currency?: string | null | undefined;
    los_pricing?: Record<string, unknown> | null | undefined;
}, {
    data: {
        date: string;
        price: number;
        user_price?: number | null | undefined;
        uncustomized_price?: number | null | undefined;
        min_stay?: number | null | undefined;
        booking_status?: string | null | undefined;
        booking_status_STLY?: string | null | undefined;
        ADR?: number | null | undefined;
        ADR_STLY?: number | null | undefined;
        unbookable?: string | number | null | undefined;
        weekly_discount?: number | null | undefined;
        monthly_discount?: number | null | undefined;
        extra_person_fee?: number | null | undefined;
        extra_person_fee_trigger?: number | null | undefined;
        check_in?: boolean | null | undefined;
        check_out?: boolean | null | undefined;
        demand_color?: string | null | undefined;
        demand_desc?: string | null | undefined;
        booked_date?: string | null | undefined;
        booked_date_STLY?: string | null | undefined;
        reason?: Record<string, unknown> | null | undefined;
    }[];
    id: string;
    pms: string;
    status?: string | undefined;
    group?: string | null | undefined;
    last_refreshed_at?: string | null | undefined;
    currency?: string | null | undefined;
    los_pricing?: Record<string, unknown> | null | undefined;
}>;
export declare const OverrideEntrySchema: z.ZodObject<{
    date: z.ZodString;
    price: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    price_type: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    currency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    min_stay: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    min_price: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    min_price_type: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    max_price: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    max_price_type: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    check_in_check_out_enabled: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodNumber]>>>;
    check_in: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    check_out: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    date: string;
    currency?: string | null | undefined;
    price?: string | null | undefined;
    min_stay?: number | null | undefined;
    check_in?: string | null | undefined;
    check_out?: string | null | undefined;
    reason?: string | null | undefined;
    price_type?: string | null | undefined;
    min_price?: number | null | undefined;
    min_price_type?: string | null | undefined;
    max_price?: number | null | undefined;
    max_price_type?: string | null | undefined;
    check_in_check_out_enabled?: string | number | null | undefined;
}, {
    date: string;
    currency?: string | null | undefined;
    price?: string | null | undefined;
    min_stay?: number | null | undefined;
    check_in?: string | null | undefined;
    check_out?: string | null | undefined;
    reason?: string | null | undefined;
    price_type?: string | null | undefined;
    min_price?: number | null | undefined;
    min_price_type?: string | null | undefined;
    max_price?: number | null | undefined;
    max_price_type?: string | null | undefined;
    check_in_check_out_enabled?: string | number | null | undefined;
}>;
export declare const NeighborhoodDataSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodString>;
    data: z.ZodObject<{
        "Listings Used": z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        currency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        source: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lat: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        lng: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        "Neighborhood Data Source": z.ZodOptional<z.ZodNullable<z.ZodString>>;
        "Future Percentile Prices": z.ZodOptional<z.ZodNullable<z.ZodObject<{
            X_values: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            Y_values: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodUnknown, "many">, "many">>;
        }, "strip", z.ZodTypeAny, {
            X_values?: string[] | undefined;
            Y_values?: unknown[][] | undefined;
        }, {
            X_values?: string[] | undefined;
            Y_values?: unknown[][] | undefined;
        }>>>;
        "Summary Table Base Price": z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        "Future Occ/New/Canc": z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        "Market KPI": z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, "strip", z.ZodTypeAny, {
        currency?: string | null | undefined;
        "Listings Used"?: number | null | undefined;
        source?: string | null | undefined;
        lat?: number | null | undefined;
        lng?: number | null | undefined;
        "Neighborhood Data Source"?: string | null | undefined;
        "Future Percentile Prices"?: {
            X_values?: string[] | undefined;
            Y_values?: unknown[][] | undefined;
        } | null | undefined;
        "Summary Table Base Price"?: Record<string, unknown> | null | undefined;
        "Future Occ/New/Canc"?: Record<string, unknown> | null | undefined;
        "Market KPI"?: Record<string, unknown> | null | undefined;
    }, {
        currency?: string | null | undefined;
        "Listings Used"?: number | null | undefined;
        source?: string | null | undefined;
        lat?: number | null | undefined;
        lng?: number | null | undefined;
        "Neighborhood Data Source"?: string | null | undefined;
        "Future Percentile Prices"?: {
            X_values?: string[] | undefined;
            Y_values?: unknown[][] | undefined;
        } | null | undefined;
        "Summary Table Base Price"?: Record<string, unknown> | null | undefined;
        "Future Occ/New/Canc"?: Record<string, unknown> | null | undefined;
        "Market KPI"?: Record<string, unknown> | null | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    data: {
        currency?: string | null | undefined;
        "Listings Used"?: number | null | undefined;
        source?: string | null | undefined;
        lat?: number | null | undefined;
        lng?: number | null | undefined;
        "Neighborhood Data Source"?: string | null | undefined;
        "Future Percentile Prices"?: {
            X_values?: string[] | undefined;
            Y_values?: unknown[][] | undefined;
        } | null | undefined;
        "Summary Table Base Price"?: Record<string, unknown> | null | undefined;
        "Future Occ/New/Canc"?: Record<string, unknown> | null | undefined;
        "Market KPI"?: Record<string, unknown> | null | undefined;
    };
    status?: string | undefined;
}, {
    data: {
        currency?: string | null | undefined;
        "Listings Used"?: number | null | undefined;
        source?: string | null | undefined;
        lat?: number | null | undefined;
        lng?: number | null | undefined;
        "Neighborhood Data Source"?: string | null | undefined;
        "Future Percentile Prices"?: {
            X_values?: string[] | undefined;
            Y_values?: unknown[][] | undefined;
        } | null | undefined;
        "Summary Table Base Price"?: Record<string, unknown> | null | undefined;
        "Future Occ/New/Canc"?: Record<string, unknown> | null | undefined;
        "Market KPI"?: Record<string, unknown> | null | undefined;
    };
    status?: string | undefined;
}>;
export declare const ReservationEntrySchema: z.ZodObject<{
    listing_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    listing_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reservation_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    check_in: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    check_out: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    booked_date: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cancelled_on: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    booking_status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    rental_revenue: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    total_cost: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    no_of_days: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    currency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    currency?: string | null | undefined;
    booking_status?: string | null | undefined;
    check_in?: string | null | undefined;
    check_out?: string | null | undefined;
    booked_date?: string | null | undefined;
    listing_id?: string | null | undefined;
    listing_name?: string | null | undefined;
    reservation_id?: string | null | undefined;
    cancelled_on?: string | null | undefined;
    rental_revenue?: string | null | undefined;
    total_cost?: string | null | undefined;
    no_of_days?: number | null | undefined;
}, {
    currency?: string | null | undefined;
    booking_status?: string | null | undefined;
    check_in?: string | null | undefined;
    check_out?: string | null | undefined;
    booked_date?: string | null | undefined;
    listing_id?: string | null | undefined;
    listing_name?: string | null | undefined;
    reservation_id?: string | null | undefined;
    cancelled_on?: string | null | undefined;
    rental_revenue?: string | null | undefined;
    total_cost?: string | null | undefined;
    no_of_days?: number | null | undefined;
}>;
export declare const ReservationsResponseSchema: z.ZodObject<{
    pms_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    next_page: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    data: z.ZodArray<z.ZodObject<{
        listing_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        listing_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reservation_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        check_in: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        check_out: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        booked_date: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        cancelled_on: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        booking_status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        rental_revenue: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        total_cost: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        no_of_days: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        currency: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        currency?: string | null | undefined;
        booking_status?: string | null | undefined;
        check_in?: string | null | undefined;
        check_out?: string | null | undefined;
        booked_date?: string | null | undefined;
        listing_id?: string | null | undefined;
        listing_name?: string | null | undefined;
        reservation_id?: string | null | undefined;
        cancelled_on?: string | null | undefined;
        rental_revenue?: string | null | undefined;
        total_cost?: string | null | undefined;
        no_of_days?: number | null | undefined;
    }, {
        currency?: string | null | undefined;
        booking_status?: string | null | undefined;
        check_in?: string | null | undefined;
        check_out?: string | null | undefined;
        booked_date?: string | null | undefined;
        listing_id?: string | null | undefined;
        listing_name?: string | null | undefined;
        reservation_id?: string | null | undefined;
        cancelled_on?: string | null | undefined;
        rental_revenue?: string | null | undefined;
        total_cost?: string | null | undefined;
        no_of_days?: number | null | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    data: {
        currency?: string | null | undefined;
        booking_status?: string | null | undefined;
        check_in?: string | null | undefined;
        check_out?: string | null | undefined;
        booked_date?: string | null | undefined;
        listing_id?: string | null | undefined;
        listing_name?: string | null | undefined;
        reservation_id?: string | null | undefined;
        cancelled_on?: string | null | undefined;
        rental_revenue?: string | null | undefined;
        total_cost?: string | null | undefined;
        no_of_days?: number | null | undefined;
    }[];
    pms_name?: string | null | undefined;
    next_page?: boolean | null | undefined;
}, {
    data: {
        currency?: string | null | undefined;
        booking_status?: string | null | undefined;
        check_in?: string | null | undefined;
        check_out?: string | null | undefined;
        booked_date?: string | null | undefined;
        listing_id?: string | null | undefined;
        listing_name?: string | null | undefined;
        reservation_id?: string | null | undefined;
        cancelled_on?: string | null | undefined;
        rental_revenue?: string | null | undefined;
        total_cost?: string | null | undefined;
        no_of_days?: number | null | undefined;
    }[];
    pms_name?: string | null | undefined;
    next_page?: boolean | null | undefined;
}>;
