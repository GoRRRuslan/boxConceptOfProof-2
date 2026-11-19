"""CPU per thread from an exported Instruments Time Profiler table (1 sample = 1 ms of CPU)."""
import collections
import sys
import xml.etree.ElementTree as ET

root = ET.parse(sys.argv[1]).getroot()
elements_by_id = {}


def register(element):
    if "id" in element.attrib:
        elements_by_id[element.attrib["id"]] = element
    for child in element:
        register(child)


register(root)
resolve = lambda element: elements_by_id[element.attrib["ref"]] if "ref" in element.attrib else element

by_thread = collections.Counter()
total = 0
for row in root.findall(".//row"):
    children = [resolve(child) for child in row]
    weight = next((int(child.text) for child in children if child.tag == "weight"), 0)
    by_thread[children[1].attrib.get("fmt", "?")] += weight
    total += weight

print(f"total CPU: {total / 1e6:.0f} ms over the capture window")
for thread, weight in by_thread.most_common(8):
    print(f"  {weight / 1e6:8.1f} ms  {thread}")
