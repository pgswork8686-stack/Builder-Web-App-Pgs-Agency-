import { Injectable } from '@nestjs/common';

export interface StageDep {
  predecessorStageId: string;
  successorStageId: string;
}

export interface ItemDep {
  predecessorStageItemId: string;
  successorStageItemId: string;
}

@Injectable()
export class WorkflowValidationService {
  detectStageCycles(dependencies: StageDep[]): boolean {
    const adj = new Map<string, string[]>();
    for (const dep of dependencies) {
      if (dep.predecessorStageId === dep.successorStageId) return true;
      const list = adj.get(dep.predecessorStageId) || [];
      list.push(dep.successorStageId);
      adj.set(dep.predecessorStageId, list);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const isCyclic = (node: string): boolean => {
      if (recStack.has(node)) return true;
      if (visited.has(node)) return false;

      visited.add(node);
      recStack.add(node);

      const neighbors = adj.get(node) || [];
      for (const neighbor of neighbors) {
        if (isCyclic(neighbor)) return true;
      }
      recStack.delete(node);
      return false;
    };

    for (const node of adj.keys()) {
      if (isCyclic(node)) return true;
    }
    return false;
  }

  detectItemCycles(dependencies: ItemDep[]): boolean {
    const adj = new Map<string, string[]>();
    for (const dep of dependencies) {
      if (dep.predecessorStageItemId === dep.successorStageItemId) return true;
      const list = adj.get(dep.predecessorStageItemId) || [];
      list.push(dep.successorStageItemId);
      adj.set(dep.predecessorStageItemId, list);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const isCyclic = (node: string): boolean => {
      if (recStack.has(node)) return true;
      if (visited.has(node)) return false;

      visited.add(node);
      recStack.add(node);

      const neighbors = adj.get(node) || [];
      for (const neighbor of neighbors) {
        if (isCyclic(neighbor)) return true;
      }
      recStack.delete(node);
      return false;
    };

    for (const node of adj.keys()) {
      if (isCyclic(node)) return true;
    }
    return false;
  }
}
