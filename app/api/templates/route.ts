import { NextRequest, NextResponse } from "next/server"
import {
  getAllTemplates,
  getTemplateById,
  getTemplatesByCategory,
  searchTemplates,
  getCategoryInfo,
  TemplateCategory,
} from "@/lib/templates"
import {
  getPopularTemplates,
  getFeaturedTemplates,
  getTemplateCategories,
} from "@/lib/templates/service"

/**
 * GET /api/templates
 * List all bot templates with optional filtering
 *
 * Query parameters:
 * - category: Filter by category (monitoring, notifications, integrations, data, productivity)
 * - search: Search templates by name, description, or tags
 * - id: Get a specific template by ID
 * - featured: If "true", return featured templates
 * - popular: If "true", return popular templates
 * - categories: If "true", return category list with counts
 * - limit: Pagination limit
 * - offset: Pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const category = searchParams.get("category")
    const search = searchParams.get("search")
    const featured = searchParams.get("featured")
    const popular = searchParams.get("popular")
    const categoriesOnly = searchParams.get("categories")
    const limit = parseInt(searchParams.get("limit") || "50", 10)
    const offset = parseInt(searchParams.get("offset") || "0", 10)

    // Return category list with counts
    if (categoriesOnly === "true") {
      const categories = getTemplateCategories()
      return NextResponse.json({ categories }, { status: 200 })
    }

    // Return featured templates
    if (featured === "true") {
      const templates = getFeaturedTemplates()
      return NextResponse.json({
        templates: templates.map(formatTemplateSummary),
        total: templates.length,
        hasMore: false,
      }, { status: 200 })
    }

    // Return popular templates
    if (popular === "true") {
      const templates = getPopularTemplates(Math.min(limit, 12))
      return NextResponse.json({
        templates: templates.map(formatTemplateSummary),
        total: templates.length,
        hasMore: false,
      }, { status: 200 })
    }

    // Get specific template by ID (with full details)
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
      const searchResults = searchTemplates(search)
      // If category filter is also applied, intersect the results
      if (category) {
        templates = templates.filter(t => searchResults.some(s => s.id === t.id))
      } else {
        templates = searchResults
      }
    }

    // Apply pagination
    const total = templates.length
    const paginatedTemplates = templates.slice(offset, offset + limit)
    const hasMore = offset + paginatedTemplates.length < total

    // Return templates with summary info (exclude full config for list view)
    const templateSummaries = paginatedTemplates.map(formatTemplateSummary)

    return NextResponse.json(
      {
        templates: templateSummaries,
        total,
        hasMore,
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

function formatTemplateSummary(t: ReturnType<typeof getTemplateById>) {
  if (!t) return null
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    icon: t.icon,
    tags: t.tags,
    triggerType: t.config.type,
  }
}
