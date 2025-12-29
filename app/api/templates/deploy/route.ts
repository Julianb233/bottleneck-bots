import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"
import { deployTemplate, validateTemplateValues } from "@/lib/templates/service"
import { getTemplateById } from "@/lib/templates"

/**
 * POST /api/templates/deploy
 * Deploy a template as a new bot
 *
 * Request body:
 * - templateId: ID of the template to deploy
 * - name: Name for the new bot
 * - description: Optional description
 * - values: Object containing values for template fields
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getServerSupabase()

    // Get authenticated user
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession()

    if (authError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { templateId, name, description, values = {} } = body

    // Validate required fields
    if (!templateId || typeof templateId !== "string") {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      )
    }

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Bot name is required" },
        { status: 400 }
      )
    }

    // Check template exists
    const template = getTemplateById(templateId)
    if (!template) {
      return NextResponse.json(
        { error: `Template not found: ${templateId}` },
        { status: 404 }
      )
    }

    // Validate values before deployment
    const validation = validateTemplateValues(template, values)
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      )
    }

    // Deploy the template
    const result = await deployTemplate({
      templateId,
      name: name.trim(),
      description: description?.trim(),
      values,
      userId: session.user.id,
    })

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || "Failed to deploy template",
          warnings: result.warnings,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        botId: result.botId,
        webhookUrl: result.webhookUrl,
        warnings: result.warnings,
        message: `Bot "${name}" created successfully from template "${template.name}"`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error deploying template:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/templates/deploy?validate=true
 * Validate template values without deploying
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { templateId, values = {} } = body

    if (!templateId) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      )
    }

    const template = getTemplateById(templateId)
    if (!template) {
      return NextResponse.json(
        { error: `Template not found: ${templateId}` },
        { status: 404 }
      )
    }

    const validation = validateTemplateValues(template, values)

    return NextResponse.json(
      {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        requiredFields: template.configSchema.fields
          .filter(f => f.required)
          .map(f => ({ key: f.key, label: f.label, type: f.type })),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error validating template:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
