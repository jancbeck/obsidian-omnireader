import { App, Modal } from "obsidian";
import { StrictMode, useState, useEffect, useRef } from "react";
import { Root, createRoot } from "react-dom/client";

export class AnnotateModal extends Modal {
	root: Root | null = null;
	value = "";
	colorOptions: string[] = [];
	onSubmit = (value: string) => {};
	prevValue = "";
	prevColor = "";
	constructor(
		app: App,
		onSubmit: (result: string) => void,
		colorOptions: string[],
		prevValue = "",
		prevColor = ""
	) {
		super(app);
		this.modalEl.addClass("w-96");
		this.containerEl.addClass("[&>.modal-bg]:hidden");
		this.onSubmit = onSubmit;
		this.colorOptions = colorOptions;
		this.prevValue = prevValue;
		this.prevColor = prevColor;
	}

	onClose() {
		this.root?.unmount();
	}

	onOpen() {
		this.root = createRoot(this.contentEl);
		const submitHandler = (value: string) => {
			this.close();
			this.onSubmit(value);
		};
		this.root.render(
			<StrictMode>
				<AnnotateForm
					submitHandler={submitHandler}
					colorOptions={this.colorOptions}
					prevValue={this.prevValue}
					prevColor={this.prevColor}
				/>
			</StrictMode>
		);
	}
}

function AnnotateForm({
	submitHandler,
	colorOptions,
	prevValue = "",
	prevColor = "",
}: {
	submitHandler: (name: string) => void;
	colorOptions: string[];
	prevValue?: string;
	prevColor?: string;
}) {
	const [value, setValue] = useState(prevValue);
	const [selectedColor, setSelectedColor] = useState(prevColor);

	const handleSubmit = () => {
		if (value.trim()) {
			submitHandler(value + (selectedColor ? ` @${selectedColor}` : ""));
		}
	};

	const textareaRef = useRef<HTMLTextAreaElement | null>(null);

	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.focus();
		}
	}, []);
	return (
		<>
			<button className="clickable-icon -mt-4 mb-2 text-red-500">
				Delete
			</button>
			<textarea
				ref={textareaRef}
				className="mb-1 w-full"
				value={value}
				rows={3}
				onChange={(e) => {
					setValue(e.target.value);
				}}
				placeholder="Type here and press Enter to submit"
				onKeyDown={(e) => {
					// Optional: Allow submission with Enter key
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						handleSubmit();
					}
				}}
			/>
			<div className="flex">
				<div className="flex flex-1 items-center gap-x-2">
					{["", ...colorOptions].map((color) => (
						<button
							type="button"
							key={color}
							onClick={() => setSelectedColor(color)}
							style={{
								backgroundColor: color || "transparent",
								outlineColor:
									selectedColor === color
										? "var(--interactive-accent-hover)"
										: "transparent",
							}}
							className="size-6 rounded-full border-transparent outline-none hover:brightness-95"
						>
							<span className="sr-only">{color || "none"}</span>
						</button>
					))}
				</div>
				<button className="mod-cta" onClick={handleSubmit}>
					Submit
				</button>
			</div>
		</>
	);
}
