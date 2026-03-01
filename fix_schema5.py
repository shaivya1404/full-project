#!/usr/bin/env python3
"""
Add @updatedAt to all 'updatedAt DateTime' fields that don't already have it.
"""
import re

schema_path = r"C:\Users\DELL\Desktop\wxwqxqwxw\new models\backend\prisma\schema.prisma"

with open(schema_path, "r", encoding="utf-8") as f:
    content = f.read()

# Match lines with updatedAt DateTime without @updatedAt
pattern = re.compile(
    r'^(\s+)(updatedAt)(\s+)(DateTime)(\s*)$',
    re.MULTILINE
)

changes = []

def replacer(m):
    indent = m.group(1)
    spacing = m.group(3)
    changes.append(f"  Added @updatedAt to updatedAt field")
    return f"{indent}updatedAt{spacing}DateTime @updatedAt"

new_content = pattern.sub(replacer, content)

print(f"Total changes: {len(changes)}")

with open(schema_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Schema updated successfully.")
