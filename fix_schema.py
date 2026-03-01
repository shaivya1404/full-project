#!/usr/bin/env python3
"""
Fix PascalCase relation field names to camelCase in Prisma schema.
Only renames fields where the field name matches the referenced model name (PascalCase).
"""
import re

schema_path = r"C:\Users\DELL\Desktop\wxwqxqwxw\new models\backend\prisma\schema.prisma"

with open(schema_path, "r", encoding="utf-8") as f:
    content = f.read()

# Pattern matches relation fields inside model blocks
# Captures lines like:
#   TeamMember  TeamMember[]  (field named same as model type, PascalCase)
#   Team        Team          @relation(...)
# We want to rename the FIELD NAME (first token) to camelCase if it matches the TYPE NAME

# Match: <indent><FieldName><whitespace><TypeName> where FieldName == TypeName (or TypeName[])
line_pattern = re.compile(
    r'^(\s+)([A-Z][a-zA-Z0-9]*)(\s+)([A-Z][a-zA-Z0-9]*)(\[\])?(\s+@[^\n]*)?$',
    re.MULTILINE
)

changes = []

def to_camel(name):
    return name[0].lower() + name[1:]

def replacer(m):
    indent = m.group(1)
    field_name = m.group(2)
    spacing = m.group(3)
    type_name = m.group(4)
    array_suffix = m.group(5) or ""
    rest = m.group(6) or ""

    # Only rename if field name == type name (both PascalCase, matching)
    if field_name == type_name:
        new_field = to_camel(field_name)
        changes.append(f"  {field_name} -> {new_field}  (type: {type_name}{array_suffix})")
        return f"{indent}{new_field}{spacing}{type_name}{array_suffix}{rest}"
    return m.group(0)

new_content = line_pattern.sub(replacer, content)

print(f"Made {len(changes)} changes:")
for c in changes:
    print(c)

with open(schema_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("\nSchema updated successfully.")
