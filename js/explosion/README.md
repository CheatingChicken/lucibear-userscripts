# DOM Explosion Modular Structure

## Overview

The DOM explosion system has been split into focused, indexed modules in `js/explosion/` to reduce corruption risk and improve maintainability.

## Module Structure

### `01-textSplitter.mjs`

-   **Purpose**: Split text nodes into word spans for granular physics
-   **Exports**: `splitTextNodes(root)`
-   **Dependencies**: None

### `02-elementSkipping.mjs`

-   **Purpose**: Detect and mark transparent containers to skip
-   **Exports**:
    -   `shouldSkipElement(el)` - Check if element should be skipped
    -   `markElementSkipped(el, skippedElements, container)` - Mark element as skipped
-   **Dependencies**: None

### `03-cloneCreation.mjs`

-   **Purpose**: Create physics elements from DOM elements
-   **Exports**:
    -   `createPhysicsElement(el, container, explX, explY, blastStrength, repairedOriginals)` - Create PE
-   **Dependencies**: `../physicsElement.mjs`

### `04-repairTraversal.mjs`

-   **Purpose**: Handle repair chain traversal and marking
-   **Exports**:
    -   `markRepairChains(container, repairedOriginals)` - Mark unbroken chains as repaired
    -   `updateCloneRepairability(clones)` - Update clone repairability based on parent status
-   **Dependencies**: None

### `05-shockwave.mjs`

-   **Purpose**: Process shockwave physics and impulse application
-   **Exports**: `processShockwave(clones, explX, explY, blastStrength)`
-   **Dependencies**: None

### `index.mjs`

-   **Purpose**: Main orchestrator that coordinates all modules
-   **Exports**: `initDomExplosion()` - Main initialization function
-   **Dependencies**: All above modules + `../fireworks.mjs`

## Key Changes

### PhysicsElement Updates

-   **Removed**: Static `_repairAllowed` property
-   **Added**: `isRepairable()` method that dynamically checks parent's repair status
-   **Logic**: PE is repairable if original element's parent is `.wrap` or has `repaired-original` class

### Repair Chain Logic

-   **Top-to-bottom traversal**: After all PEs created, traverse DOM tree from `.wrap` down
-   **Chain marking**: Mark unbroken chains of skipped/repaired elements as repaired
-   **Dynamic updates**: Clone repairability updates based on parent repair status

### Debug Visualization

-   **Yellow borders**: `.dom-skip` and `.repaired-original` elements
-   **Green borders**: `.phy-clone.repairable` elements
-   **Visual feedback**: Real-time updates as repair chains propagate

## Usage

Import the main orchestrator:

```javascript
import { initDomExplosion } from "./explosion/index.mjs";
```

The API remains the same - call `initDomExplosion().trigger()` to start the explosion.

## Testing

Local server running at http://localhost:8000

-   Test explosion: Click SELF-DESTRUCT button
-   Test repairs: Drag pieces near original positions
-   Verify debug borders appear on skipped/repaired/repairable elements
