#!/usr/bin/env python3
"""
Add @default(cuid()) to all 'id String @id' fields that don't already have a @default.
This applies to dashboard models that rely on app-level ID generation.
"""
import re

schema_path = r"C:\Users\DELL\Desktop\wxwqxqwxw\new models\backend\prisma\schema.prisma"

with open(schema_path, "r", encoding="utf-8") as f:
    content = f.read()

# Match: <spaces>id<spaces>String<spaces>@id<end or whitespace>
# but NOT lines that already have @default
pattern = re.compile(
    r'^(\s+)(id)(\s+)(String)(\s+)(@id)(\s*)$',
    re.MULTILINE
)

changes = []

def replacer(m):
    indent = m.group(1)
    rest = m.group(3) + m.group(4) + m.group(5) + m.group(6)
    # Check if this line already has @default somehow (shouldn't, but be safe)
    full_line = m.group(0)
    if '@default' in full_line:
        return full_line
    changes.append(f"  Added @default(cuid()) to: {full_line.strip()}")
    return f"{indent}id{m.group(3)}{m.group(4)}{m.group(5)}{m.group(6)} @default(cuid()){m.group(7)}"

new_content = pattern.sub(replacer, content)

print(f"Total changes: {len(changes)}")
for c in changes:
    print(c)

with open(schema_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("\nSchema updated successfully.")
