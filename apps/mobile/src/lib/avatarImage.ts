import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

export type AvatarSource = "camera" | "library";

// ADR-051: the avatars bucket takes a square JPEG of at most 512 px and 1 MB.
const SIZE = 512;
const QUALITY = 0.8;

export type PickResult = { uri: string } | { denied: true } | null;

// Camera or gallery, then a centred square at 512 px. null: the user backed out.
export async function pickAvatar(source: AvatarSource): Promise<PickResult> {
	if (source === "camera") {
		const permission = await ImagePicker.requestCameraPermissionsAsync();
		if (!permission.granted) {
			return { denied: true };
		}
	}
	const options: ImagePicker.ImagePickerOptions = {
		mediaTypes: ["images"],
		allowsEditing: true,
		aspect: [1, 1],
		quality: 1,
	};
	const result =
		source === "camera"
			? await ImagePicker.launchCameraAsync(options)
			: await ImagePicker.launchImageLibraryAsync(options);
	const asset = result.canceled ? undefined : result.assets[0];
	if (asset === undefined) {
		return null;
	}
	// The editor's crop is a hint on Android; crop again so the stored photo is always square.
	const side = Math.min(asset.width, asset.height);
	const context = ImageManipulator.manipulate(asset.uri)
		.crop({
			originX: Math.floor((asset.width - side) / 2),
			originY: Math.floor((asset.height - side) / 2),
			width: side,
			height: side,
		})
		.resize({ width: Math.min(SIZE, side), height: Math.min(SIZE, side) });
	const image = await context.renderAsync();
	const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY });
	return { uri: saved.uri };
}
