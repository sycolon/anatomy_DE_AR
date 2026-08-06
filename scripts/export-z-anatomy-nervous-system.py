"""Export the Z-Anatomy neural atlas as a compact, two-layer GLB.

Run with Blender 3.6 LTS or newer:
  blender --background Startup.blend --python scripts/export-z-anatomy-nervous-system.py -- output.glb
"""

import bpy
import re
import sys


def output_path():
    arguments = sys.argv
    if "--" not in arguments or len(arguments) <= arguments.index("--") + 1:
        raise SystemExit("Pass the output GLB path after --")
    return arguments[arguments.index("--") + 1]


CENTRAL_COLLECTIONS = {
    "Central nervous system",
    "Brain",
    "Brainstem",
    "Cerebellum",
    "Cerebrum",
    "Cerebral cortex",
    "Cerebral hemisphere",
    "Meninges",
    "Neo-cortex",
    "Spinal cord",
    "Telencephalon",
}
PERIPHERAL_COLLECTIONS = {
    "Autonomic division of peripheral nervous system",
    "Cranial nerves",
    "Nerves",
    "Peripheral nervous system",
    "Spinal nerves",
    "Sympathetic trunk",
}
CENTRAL_PATTERN = re.compile(
    r"brain|cerebr|cerebell|spinal cord|medulla oblongata|midbrain|pons|thalam|"
    r"hypothalam|hippocamp|amygdal|corpus callosum|caudate nucleus|putamen|"
    r"globus pallidus|striat|collicul|funiculus|neural tract|spinocerebellar|"
    r"corticospinal|rubrospinal|tectospinal|mening|dura|arachnoid|cranial pia|"
    r"gyrus|sulcus|cortex|telenceph|nucleus|tract|fasciculus|central canal|"
    r"intermediate substance|commissure|white matter",
    re.IGNORECASE,
)
PERIPHERAL_PATTERN = re.compile(r"nerve|ganglion|plexus|sympathetic", re.IGNORECASE)


def classify(obj):
    memberships = {collection.name for collection in obj.users_collection}
    if memberships & PERIPHERAL_COLLECTIONS or PERIPHERAL_PATTERN.search(obj.name):
        return "peripheral"
    if memberships & CENTRAL_COLLECTIONS or CENTRAL_PATTERN.search(obj.name):
        return "central"
    return None


def material(name, color, roughness):
    atlas_material = bpy.data.materials.new(name)
    atlas_material.diffuse_color = (*color, 1.0)
    atlas_material.use_nodes = True
    principled = atlas_material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = 0.0
    return atlas_material


def prepare_group(objects, name, atlas_material):
    prepared = []
    for source in objects:
        if bpy.context.scene.collection.objects.get(source.name) is None:
            bpy.context.scene.collection.objects.link(source)
        source.hide_set(False)
        source.hide_viewport = False
        source.hide_render = False
        bpy.ops.object.select_all(action="DESELECT")
        source.select_set(True)
        bpy.context.view_layer.objects.active = source

        if source.type == "CURVE":
            source.data.resolution_u = min(source.data.resolution_u, 2)
            source.data.bevel_resolution = min(source.data.bevel_resolution, 1)
            bpy.ops.object.convert(target="MESH")
            source = bpy.context.view_layer.objects.active

        if source.type != "MESH" or len(source.data.polygons) == 0:
            continue

        source.data.materials.clear()
        source.data.materials.append(atlas_material)
        prepared.append(source)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in prepared:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = prepared[0]
    with bpy.context.temp_override(
        active_object=prepared[0],
        selected_objects=prepared,
        selected_editable_objects=prepared,
    ):
        bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    joined["source"] = "Z-Anatomy human male atlas"
    joined["license"] = "Creative Commons Attribution-ShareAlike 4.0 International"
    joined["source_url"] = "https://github.com/Z-Anatomy/Models-of-human-anatomy"
    return joined


top_collection = bpy.data.collections.get("7: Nervous system & Sense organs")
if top_collection is None:
    raise SystemExit("The Z-Anatomy nervous-system collection was not found")

central_sources = []
peripheral_sources = []
for obj in top_collection.objects:
    if obj.type not in {"MESH", "CURVE"} or obj.name.endswith(".j"):
        continue
    group = classify(obj)
    if group == "central":
        central_sources.append(obj)
    elif group == "peripheral":
        peripheral_sources.append(obj)

# Remove unrelated systems before curve conversion. The source atlas contains
# dependency-heavy organ rigs; keeping them would force a full-body dependency
# graph update for every nerve even though none of that geometry is exported.
selected_sources = central_sources + peripheral_sources
keep = set(selected_sources)
for source in selected_sources:
    parent = source.parent
    while parent is not None:
        keep.add(parent)
        parent = parent.parent
    if source.type == "CURVE":
        if source.data.bevel_object is not None:
            keep.add(source.data.bevel_object)
        if source.data.taper_object is not None:
            keep.add(source.data.taper_object)

unrelated_objects = [obj for obj in bpy.data.objects if obj not in keep]
bpy.data.batch_remove(unrelated_objects)
bpy.context.view_layer.update()

central_material = material("Central neural tissue", (0.70, 0.28, 0.42), 0.68)
peripheral_material = material("Peripheral nerves", (0.95, 0.67, 0.10), 0.62)
central = prepare_group(central_sources, "Central nervous system", central_material)
peripheral = prepare_group(peripheral_sources, "Peripheral nervous system", peripheral_material)

bpy.ops.object.select_all(action="DESELECT")
central.select_set(True)
peripheral.select_set(True)
bpy.context.view_layer.objects.active = central

bpy.context.scene["title"] = "Human nervous system — scientific educational medical atlas"
bpy.context.scene["source"] = "Z-Anatomy human male atlas"
bpy.context.scene["license"] = "Creative Commons Attribution-ShareAlike 4.0 International"
bpy.context.scene["processing"] = "Neural structures selected by anatomical collection and terminology; labels and helper geometry excluded"

bpy.ops.export_scene.gltf(
    filepath=output_path(),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_materials="EXPORT",
    export_normals=True,
    export_texcoords=False,
    export_colors=False,
    export_cameras=False,
    export_lights=False,
    export_extras=True,
)

print(f"Exported {len(central_sources)} central and {len(peripheral_sources)} peripheral atlas structures")
