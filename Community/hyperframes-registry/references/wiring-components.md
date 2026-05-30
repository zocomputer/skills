# Wiring Components

Components are snippets pasted into a host composition.

## Process

1. Read installed component file, usually `compositions/components/<name>.html`.
2. Copy component HTML into the host `div[data-composition-id]`.
3. Copy component CSS into the host style block.
4. Copy component JS before the host timeline code if needed.
5. Add component animation calls to the host timeline if the snippet exposes them.
6. Run lint, validate, and inspect.

## Integration checks

- Class names do not collide with host scene names.
- Component colors come from `DESIGN.md` variables or palette.
- Component motion does not conflict with existing tweens on the same properties.
- Decorative overflow is marked `data-layout-ignore` if inspect should ignore it.
