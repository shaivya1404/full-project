#!/usr/bin/env python3
"""
Fix relation field names in Prisma schema to match what the codebase expects.
Two types of fixes:
1. Special renames (completely different names like TeamMember->members)
2. Pluralization: array relations (Type[]) should use plural field names
"""
import re

schema_path = r"C:\Users\DELL\Desktop\wxwqxqwxw\new models\backend\prisma\schema.prisma"

with open(schema_path, "r", encoding="utf-8") as f:
    content = f.read()

# -----------------------------------------------------------------------
# SPECIAL RENAMES: (old_field_name, type_name, new_field_name)
# These are cases where the code uses a completely different name
# -----------------------------------------------------------------------
SPECIAL_RENAMES = [
    # Team model - TeamMember[] should be "members"
    ("teamMember", "TeamMember", "members"),
    # Order model - OrderItem[] should be "items"
    ("orderItem", "OrderItem", "items"),
    # Customer model - CustomerPreference? should be "preferences"
    ("customerPreference", "CustomerPreference", "preferences"),
    # Complaint model - ComplaintComment[] should be "comments"
    ("complaintComment", "ComplaintComment", "comments"),
    # Complaint model - ComplaintHistory[] should be "history"
    ("complaintHistory", "ComplaintHistory", "history"),
    # Complaint model - ComplaintAttachment[] should be "attachments"
    ("complaintAttachment", "ComplaintAttachment", "attachments"),
    # Complaint model - ComplaintFeedback? should be "feedback"
    ("complaintFeedback", "ComplaintFeedback", "feedback"),
    # Call model - Recording[] should be "recordings"
    ("recording", "Recording", "recordings"),
    # Call model - Transcript[] should be "transcripts"
    ("transcript", "Transcript", "transcripts"),
    # Call model - Analytics[] should be "analytics" (already plural, keep)
    # ("analytics", "Analytics", "analytics"),  # no change
    # KnowledgeBaseSource model - FactVerification[] should be "factVerifications"
    ("factVerification", "FactVerification", "factVerifications"),
    # Product model - InventoryMovement[] should be "inventoryMovements"
    ("inventoryMovement", "InventoryMovement", "inventoryMovements"),
    # Product model - KnowledgeBaseSource[] should be "knowledgeSources"
    # ("knowledgeBaseSource", "KnowledgeBaseSource", "knowledgeSources"),
]

# -----------------------------------------------------------------------
# PLURALIZATION RULES: array relations (Type[]) -> pluralized field names
# Applies when field_name == camelCase(type_name) and type has [] suffix
# -----------------------------------------------------------------------
def pluralize(name):
    """Basic English pluralization."""
    if name.endswith("y") and not name.endswith("ay") and not name.endswith("ey"):
        return name[:-1] + "ies"
    if name.endswith("s") or name.endswith("x") or name.endswith("z"):
        return name + "es"
    if name.endswith("ch") or name.endswith("sh"):
        return name + "es"
    return name + "s"

# Apply special renames first
changes = []
for old_name, type_name, new_name in SPECIAL_RENAMES:
    if old_name == new_name:
        continue
    # Match the field in any model: <indent><old_name><spaces><TypeName>[optional ?/[]]<optional @...>
    pattern = re.compile(
        r'^(\s+)' + re.escape(old_name) + r'(\s+' + re.escape(type_name) + r')',
        re.MULTILINE
    )
    new_content = pattern.sub(r'\g<1>' + new_name + r'\g<2>', content)
    if new_content != content:
        count = len(pattern.findall(content))
        changes.append(f"  SPECIAL: {old_name} -> {new_name} ({count} occurrences)")
        content = new_content

# Apply pluralization for array relations
# Match: <indent><fieldName><spaces><TypeName>[] where fieldName == camelCase(TypeName)
line_pattern = re.compile(
    r'^(\s+)([a-z][a-zA-Z0-9]*)(\s+)([A-Z][a-zA-Z0-9]*)\[\](\s+@[^\n]*)?$',
    re.MULTILINE
)

def pluralize_replacer(m):
    indent = m.group(1)
    field_name = m.group(2)
    spacing = m.group(3)
    type_name = m.group(4)
    rest = m.group(5) or ""

    # Check if field_name is camelCase version of type_name
    expected_field = type_name[0].lower() + type_name[1:]
    if field_name == expected_field:
        plural = pluralize(field_name)
        if plural != field_name:
            changes.append(f"  PLURAL: {field_name} -> {plural}  (type: {type_name}[])")
            return f"{indent}{plural}{spacing}{type_name}[]{rest}"
    return m.group(0)

content = line_pattern.sub(pluralize_replacer, content)

print(f"Total changes: {len(changes)}")
for c in changes:
    print(c)

with open(schema_path, "w", encoding="utf-8") as f:
    f.write(content)

print("\nSchema updated successfully.")
