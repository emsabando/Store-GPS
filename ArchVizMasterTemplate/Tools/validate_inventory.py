#!/usr/bin/env python3
"""Validate ArchViz Kit inventory CSVs before importing them as DataTables.

Usage: python3 validate_inventory.py Data/Units.csv Data/UnitTypes.csv

Checks ids, statuses, numbers and unit-type references, then prints a summary and
the list of camera-shot ids the floor-plan viewpoints expect to find in the level.
Exit code is 1 if any error was found.
"""
import csv
import re
import sys
from collections import Counter

STATUSES = {"Available", "Reserved", "Sold", "NotForSale"}
UNIT_COLUMNS = ["Name", "UnitId", "Building", "Floor", "UnitType", "Rooms", "Area", "BalconyArea",
                "TerraceArea", "bWhiteBox", "Price", "Status", "Tags", "BrochureUrl"]
TYPE_COLUMNS = ["Name", "DisplayName", "FloorPlan", "FloorPlan3D", "FloorPlanUrl", "Viewpoints", "InteriorLevel"]


def read(path, columns, errors):
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        missing = [c for c in columns if c not in (reader.fieldnames or [])]
        if missing:
            errors.append(f"{path}: missing columns {missing}")
        return list(reader)


def main(units_path, types_path):
    errors, warnings = [], []
    types = read(types_path, TYPE_COLUMNS, errors)
    units = read(units_path, UNIT_COLUMNS, errors)
    if errors:
        print("\n".join(errors))
        return 1

    type_ids = {t["Name"] for t in types}
    shots = []
    for t in types:
        found = re.findall(r'ShotId="([^"]+)"', t.get("Viewpoints", ""))
        if not found:
            warnings.append(f"type {t['Name']}: no viewpoints (interior button will have nowhere to go)")
        shots += found

    seen = Counter(u["Name"] for u in units)
    for uid, n in seen.items():
        if n > 1:
            errors.append(f"unit {uid}: row name used {n} times")

    for i, u in enumerate(units, start=2):
        where = f"{units_path}:{i} ({u['Name']})"
        if u["UnitId"] and u["UnitId"] != u["Name"]:
            warnings.append(f"{where}: UnitId differs from row name; the row name must equal UnitId")
        if u["Status"] not in STATUSES:
            errors.append(f"{where}: status '{u['Status']}' not one of {sorted(STATUSES)}")
        if u["UnitType"] not in type_ids:
            errors.append(f"{where}: unit type '{u['UnitType']}' not in {types_path}")
        for col, kind in (("Floor", int), ("Rooms", int), ("Price", int), ("Area", float),
                          ("BalconyArea", float), ("TerraceArea", float)):
            try:
                value = kind(u[col])
                if value < 0:
                    errors.append(f"{where}: {col} is negative")
            except ValueError:
                errors.append(f"{where}: {col} '{u[col]}' is not a valid {kind.__name__}")
        if u["bWhiteBox"] not in ("True", "False"):
            errors.append(f"{where}: bWhiteBox must be True or False")
        if not re.fullmatch(r"\(([A-Za-z0-9_]+(,[A-Za-z0-9_]+)*)?\)", u["Tags"]):
            errors.append(f"{where}: Tags must look like (Corner,LakeView) or ()")

    if not errors:
        by_status = Counter(u["Status"] for u in units)
        by_building = Counter(u["Building"] for u in units)
        prices = [int(u["Price"]) for u in units]
        areas = [float(u["Area"]) for u in units]
        print(f"{len(units)} units, {len(types)} unit types")
        print("  by building:", dict(sorted(by_building.items())))
        print("  by status:  ", dict(sorted(by_status.items())))
        print(f"  area  {min(areas):.2f} - {max(areas):.2f} m2")
        print(f"  price {min(prices):,} - {max(prices):,}")
        print(f"\nCamera shots to place in the show-flats ({len(shots)}):")
        print("  " + ", ".join(shots))
    for w in warnings:
        print("warning:", w)
    for e in errors:
        print("error:", e)
    return 1 if errors else 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2]))
