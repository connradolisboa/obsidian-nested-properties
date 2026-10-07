import type { App } from 'obsidian';

import { Modal } from 'obsidian';

export class TypeChangeModal extends Modal {
  private isConfirmed = false;
  private resolve: ((isConfirmed: boolean) => void) | undefined;

  public constructor(app: App, private readonly typeName: string) {
    super(app);
  }

  public static async confirm(app: App, typeName: string): Promise<boolean> {
    const modal = new TypeChangeModal(app, typeName);
    const promise = new Promise<boolean>((resolve) => {
      modal.resolve = resolve;
    });
    modal.open();
    return promise;
  }

  public override onClose(): void {
    super.onClose();
    this.resolve?.(this.isConfirmed);
  }

  public override onOpen(): void {
    super.onOpen();
    this.titleEl.setText(`Display as ${this.typeName}?`);
    this.contentEl.createEl('p', {
      text: 'The current value is not compatible with this type. It will be converted to fit the new format.'
    });
    const buttonContainer = this.contentEl.createDiv({ cls: 'modal-button-container' });
    buttonContainer.createEl('button', { cls: 'mod-cta', text: 'Update' }).addEventListener('click', () => {
      this.isConfirmed = true;
      this.close();
    });
    buttonContainer.createEl('button', { text: 'Cancel' }).addEventListener('click', () => {
      this.close();
    });
  }
}
