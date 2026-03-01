#!/usr/bin/env python3
"""
Fix remaining issues in Prisma schema:
1. PascalCase optional (?) relation fields -> camelCase
2. Fix 'analyticses' -> 'analytics'
"""
import re

schema_path = r"C:\Users\DELL\Desktop\wxwqxqwxw\new models\backend\prisma\schema.prisma"

with open(schema_path, "r", encoding="utf-8") as f:
    content = f.read()

changes = []

# Fix 'analyticses' -> 'analytics'
old = content
content = content.replace("  analyticses           Analytics[]", "  analytics            Analytics[]")
if content != old:
    changes.append("  analyticses -> analytics")

# Fix PascalCase optional (?) relation fields: <FieldName> <TypeName>?
# These were missed by the previous scripts because they use ? not []
optional_pattern = re.compile(
    r'^(\s+)([A-Z][a-zA-Z0-9]*)(\s+)([A-Z][a-zA-Z0-9]*)\?(\s+@[^\n]*)?$',
    re.MULTILINE
)

def to_camel(name):
    return name[0].lower() + name[1:]

def optional_replacer(m):
    indent = m.group(1)
    field_name = m.group(2)
    spacing = m.group(3)
    type_name = m.group(4)
    rest = m.group(5) or ""

    # Only fix if field_name == type_name (PascalCase match)
    if field_name == type_name:
        new_field = to_camel(field_name)
        changes.append(f"  OPT: {field_name} -> {new_field}  (type: {type_name}?)")
        return f"{indent}{new_field}{spacing}{type_name}?{rest}"
    return m.group(0)

content = optional_pattern.sub(optional_replacer, content)

print(f"Total changes: {len(changes)}")
for c in changes:
    print(c)

with open(schema_path, "w", encoding="utf-8") as f:
    f.write(content)

print("\nSchema updated successfully.")
