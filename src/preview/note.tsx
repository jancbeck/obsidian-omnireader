import { cn } from "@/lib/utils";

export default ({
	comment,
	position,
}: {
	comment: string;
	position: "left" | "right";
}) => {
	const isLeft = position === "left";
	const isRight = position === "right";
	return (
		<div
			className={cn("absolute top-0 w-[clamp(200px,15vw,400px)]", {
				"right-full mr-8": isLeft,
				"left-full ml-8": isRight,
			})}
			style={{
				fontSize: "var(--footnote-size)",
				color: "var(--text-muted)",
			}}
			id={comment}
		>
			<span>{comment}</span>
		</div>
	);
};
