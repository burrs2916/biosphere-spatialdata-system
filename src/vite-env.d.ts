/// <reference types="vite/client" />
declare module "@jiaminghi/data-view-react" {
  import { ComponentType } from "react";
  export const BorderBox1: ComponentType<any>;
  export const BorderBox2: ComponentType<any>;
  export const BorderBox3: ComponentType<any>;
  export const BorderBox4: ComponentType<any>;
  export const BorderBox5: ComponentType<any>;
  export const BorderBox6: ComponentType<any>;
  export const BorderBox7: ComponentType<any>;
  export const BorderBox8: ComponentType<any>;
  export const BorderBox9: ComponentType<any>;
  export const BorderBox10: ComponentType<any>;
  export const BorderBox12: ComponentType<any>;
  export const BorderBox13: ComponentType<any>;
  export const Decoration1: ComponentType<any>;
  export const Decoration2: ComponentType<any>;
  export const Decoration3: ComponentType<any>;
  export const Decoration4: ComponentType<any>;
  export const Decoration5: ComponentType<any>;
  export const Decoration6: ComponentType<any>;
  export const Decoration7: ComponentType<any>;
  export const Decoration8: ComponentType<any>;
  export const Decoration9: ComponentType<any>;
  export const Decoration10: ComponentType<any>;
  export const Decoration11: ComponentType<any>;
  export const Decoration12: ComponentType<any>;
}

declare module 'troika-three-text' {
  import { Object3D, Color, Material } from 'three';
  export class Text extends Object3D {
    text: string;
    font: string | null;
    fontSize: number;
    color: Color | string | number;
    anchorX: string | number;
    anchorY: string | number;
    maxWidth: number | undefined;
    lineHeight: number | undefined;
    depthTest: boolean;
    material: Material | null;
    textRenderInfo: {
      blockWidth: number;
      blockHeight: number;
    } | null;
    sync(callback?: () => void): void;
    dispose(): void;
  }
  export class BatchedText extends Text {
    addText(text: Text): void;
    removeText(text: Text): void;
  }
}
