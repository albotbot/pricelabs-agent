/**
 * Audit MCP tools: pricelabs_log_action, pricelabs_get_audit_log.
 *
 * Provides audit trail write and read capabilities. The agent logs every
 * significant action (recommendations, approvals, executions, alerts, reports)
 * and can query the audit trail for accountability, debugging, and answering
 * "what changes have been made?" questions.
 *
 * @module tools/audit
 */
import { LogActionInputSchema, GetAuditLogInputSchema, } from "../schemas/monitoring.js";
import { createAuditLogQueries } from "../db/queries/audit-log.js";
/**
 * Register audit MCP tools on the server.
 *
 * Tools registered:
 * - pricelabs_log_action (write audit entry)
 * - pricelabs_get_audit_log (read audit trail)
 *
 * @param server - MCP server instance
 * @param db - An open better-sqlite3 Database instance (with migrations applied)
 */
export function registerAuditTools(server, db) {
    const auditQueries = createAuditLogQueries(db);
    // --- pricelabs_log_action ---
    server.registerTool("pricelabs_log_action", {
        description: "Record an agent action in the audit log. Call this after every significant action: generating reports, sending alerts, making recommendations, receiving approvals, executing changes.",
        inputSchema: LogActionInputSchema.shape,
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: false,
        },
    }, async (params) => {
        try {
            auditQueries.insertEntry.run({
                action_type: params.action_type,
                listing_id: params.listing_id ?? null,
                pms: params.pms ?? null,
                description: params.description,
                details_json: params.details_json ?? null,
                channel: params.channel ?? null,
            });
            const result = {
                logged: true,
                action_type: params.action_type,
                description: params.description,
            };
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: message }),
                    },
                ],
                isError: true,
            };
        }
    });
    // --- pricelabs_get_audit_log ---
    server.registerTool("pricelabs_get_audit_log", {
        description: "Retrieve audit trail entries. Filter by listing, action type, or date range. Use for accountability, debugging, and answering 'what changes have been made?' questions.",
        inputSchema: GetAuditLogInputSchema.shape,
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: false,
        },
    }, async (params) => {
        try {
            const limit = params.limit ?? 50;
            // Default date range: 7 days ago to now
            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const startDate = params.start_date ?? sevenDaysAgo.toISOString();
            const endDate = params.end_date ?? now.toISOString();
            let entries;
            if (params.listing_id) {
                entries = auditQueries.getByListing.all({
                    listing_id: params.listing_id,
                    limit,
                });
            }
            else if (params.action_type) {
                entries = auditQueries.getByType.all({
                    action_type: params.action_type,
                    limit,
                });
            }
            else {
                entries = auditQueries.getByDateRange.all({
                    start_date: startDate,
                    end_date: endDate,
                    limit,
                });
            }
            const result = {
                entries,
                count: entries.length,
            };
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: message }),
                    },
                ],
                isError: true,
            };
        }
    });
}
