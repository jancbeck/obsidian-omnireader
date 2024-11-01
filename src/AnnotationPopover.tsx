import { useState, useRef, useEffect } from "react";
import { setIcon } from "obsidian";
interface AnnotationPopoverProps {
	initialComment?: string;
	onSave: ({
		comment,
		remove,
	}: {
		comment?: string;
		remove?: boolean;
	}) => void;
	onClose: () => void;
	position: { x: number; y: number };
}

export default function AnnotationPopover({
	initialComment = "",
	onSave,
	onClose,
	position,
}: AnnotationPopoverProps) {
	const [comment, setComment] = useState(initialComment);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const popoverRef = useRef<HTMLDivElement>(null);
	const closeButtonRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
		if (closeButtonRef.current) setIcon(closeButtonRef.current, "x");

		const handleClickOutside = (event: Event) => {
			if (
				popoverRef.current &&
				!popoverRef.current.contains(event.target as Node)
			) {
				onClose();
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleClickOutside);
		};
	}, [onClose]);

	const handleSubmit = () => {
		if (comment.includes("-->")) {
			console.log("Comment contains illegal characters");
			return;
		}
		onSave({ comment });
	};
	const handleRemove = () => {
		onSave({ remove: true });
	};

	return (
		<div
			ref={popoverRef}
			className="fixed z-50 w-64 rounded-lg border-2 border-gray-200 bg-white p-4 shadow-lg"
			style={{
				left: `${position.x}px`,
				top: `${position.y}px`,
				transform: "translate(-50%, -100%) translateY(-8px)",
			}}
		>
			<div>
				<div className="mb-1 flex">
					<div className="-ml-2 -mt-2 flex-1">
						<button
							type="button"
							onClick={handleRemove}
							className="mod-destructive text-xs !shadow-none"
						>
							Remove
						</button>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="clickable-icon -mr-2 -mt-2"
						ref={closeButtonRef}
					/>
				</div>
				<textarea
					ref={inputRef}
					value={comment}
					onChange={(e) => setComment(e.target.value)}
					className="mb-2 w-full"
					rows={5}
					placeholder="Add your annotation..."
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							handleSubmit();
						}
						if (e.key === "Escape") {
							onClose();
						}
					}}
				/>
				<div className="flex space-x-2">
					<div className="flex-1"></div>
					<button
						type="button"
						className="mod-cta"
						onClick={handleSubmit}
					>
						Save
					</button>
				</div>
			</div>
		</div>
	);
}
