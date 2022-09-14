import { RefObject } from 'react';

import { CoordinateExtent, Node, NodeDragItem, NodeInternals, XYPosition } from '../../types';
import { clampPosition } from '../../utils';

export function isParentSelected(node: Node, nodeInternals: NodeInternals): boolean {
  if (!node.parentNode) {
    return false;
  }

  const parentNode = nodeInternals.get(node.parentNode);

  if (!parentNode) {
    return false;
  }

  if (parentNode.selected) {
    return true;
  }

  return isParentSelected(parentNode, nodeInternals);
}

export function hasSelector(target: Element, selector: string, nodeRef: RefObject<Element>): boolean {
  let current = target;

  do {
    if (current?.matches(selector)) return true;
    if (current === nodeRef.current) return false;
    current = current.parentElement as Element;
  } while (current);

  return false;
}

// looks for all selected nodes and created a NodeDragItem for each of them
export function getDragItems(nodeInternals: NodeInternals, mousePos: XYPosition, nodeId?: string): NodeDragItem[] {
  return Array.from(nodeInternals.values())
    .filter((n) => (n.selected || n.id === nodeId) && (!n.parentNode || !isParentSelected(n, nodeInternals)))
    .map((n) => ({
      id: n.id,
      position: n.position || { x: 0, y: 0 },
      positionAbsolute: n.positionAbsolute || { x: 0, y: 0 },
      distance: {
        x: mousePos.x - (n.positionAbsolute?.x ?? 0),
        y: mousePos.y - (n.positionAbsolute?.y ?? 0),
      },
      delta: {
        x: 0,
        y: 0,
      },
      extent: n.extent,
      parentNode: n.parentNode,
      width: n.width,
      height: n.height,
    }));
}

export function updatePosition(
  dragItem: NodeDragItem,
  mousePos: XYPosition,
  snapToGrid: boolean,
  [snapX, snapY]: [number, number],
  nodeInternals: NodeInternals,
  nodeExtent?: CoordinateExtent
): NodeDragItem {
  let currentExtent = dragItem.extent || nodeExtent;
  const nextPosition = { x: mousePos.x - dragItem.distance.x, y: mousePos.y - dragItem.distance.y };
  if (snapToGrid) {
    nextPosition.x = snapX * Math.round(nextPosition.x / snapX)
    nextPosition.y = snapY * Math.round(nextPosition.y / snapY)
  }


  if (dragItem.extent === 'parent') {
    if (dragItem.parentNode && dragItem.width && dragItem.height) {
      const parent = nodeInternals.get(dragItem.parentNode);
      currentExtent =
        parent?.positionAbsolute && parent?.width && parent?.height
          ? [
              [parent.positionAbsolute.x, parent.positionAbsolute.y],
              [
                parent.positionAbsolute.x + parent.width - dragItem.width,
                parent.positionAbsolute.y + parent.height - dragItem.height,
              ],
            ]
          : currentExtent;
    } else {
      // @ts-ignore
      if (process.env.NODE_ENV === 'development') {
        console.warn('[React Flow]: Only child nodes can use a parent extent. Help: https://reactflow.dev/error#500');
      }
      currentExtent = nodeExtent;
    }
  } else if (dragItem.extent && dragItem.parentNode) {
    const parent = nodeInternals.get(dragItem.parentNode);
    const parentX = parent?.positionAbsolute?.x ?? 0;
    const parentY = parent?.positionAbsolute?.y ?? 0;
    currentExtent = [
      [dragItem.extent[0][0] + parentX, dragItem.extent[0][1] + parentY],
      [dragItem.extent[1][0] + parentX, dragItem.extent[1][1] + parentY],
    ];
  }

  let parentPosition = { x: 0, y: 0 };

  if (dragItem.parentNode) {
    const parentNode = nodeInternals.get(dragItem.parentNode);
    parentPosition = { x: parentNode?.positionAbsolute?.x ?? 0, y: parentNode?.positionAbsolute?.y ?? 0 };
  }

  dragItem.positionAbsolute = currentExtent
    ? clampPosition(nextPosition, currentExtent as CoordinateExtent)
    : nextPosition;

  dragItem.position = {
    x: dragItem.positionAbsolute.x - parentPosition.x,
    y: dragItem.positionAbsolute.y - parentPosition.y,
  };

  return dragItem;
}

// returns two params:
// 1. the dragged node (or the first of the list, if we are dragging a node selection)
// 2. array of selected nodes (for multi selections)
export function getEventHandlerParams({
  nodeId,
  dragItems,
  nodeInternals,
}: {
  nodeId?: string;
  dragItems: NodeDragItem[];
  nodeInternals: NodeInternals;
}): [Node, Node[]] {
  const extentedDragItems: Node[] = dragItems.map((n) => {
    const node = nodeInternals.get(n.id)!;

    return {
      ...node,
      position: n.position,
      positionAbsolute: n.positionAbsolute,
    };
  });

  return [nodeId ? extentedDragItems.find((n) => n.id === nodeId)! : extentedDragItems[0], extentedDragItems];
}
