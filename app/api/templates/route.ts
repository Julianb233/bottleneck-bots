import { NextRequest, NextResponse } from "next/server"
import {
  getAllTemplates,
  getTemplateById,
  getTemplatesByCategory,
  searchTemplates,
  TemplateCategory,
} from "@/lib/templates"

/**
 * GET /api/templates
 * List all bot templates with optional filtering
 *
 * Query parameters:
 * - category: Filter by category (monitoring, notifications, integrations, data, productivity)
 * - search: Search templates by name, description, or tags
 * - id: Get a specific template by ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const category = searchParams.get("category")
    const search = searchParams.get("search")

    // Get specific template by ID
    if (id) {
      const template = getTemplateById(id)
      if (!template) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        )
      }
      return NextResponse.json({ template }, { status: 200 })
    }

    // Get templates with filtering
    let templates = getAllTemplates()

    // Filter by category
    if (category) {
      const validCategories: TemplateCategory[] = [
        "monitoring",
        "notifications",
        "integrations",
        "data",
        "productivity",
      ]
      if (!validCategories.includes(category as TemplateCategory)) {
        return NextResponse.json(
          {
            error: `Invalid category. Must be one of: ${validCategories.join(", ")}`,
          },
          { status: 400 }
        )
      }
      templates = getTemplatesByCategory(category as TemplateCategory)
    }

    // Search by query
    if (search) {
      templates = searchTemplates(search)
    }

    // Return templates with summary info (exclude full config for list view)
    const templateSummaries = templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      icon: t.icon,
      tags: t.tags,
    }))

    return NextResponse.json(
      {
        templates: templateSummaries,
        total: templateSummaries.length,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching templates:", error)
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    )
  }
}
