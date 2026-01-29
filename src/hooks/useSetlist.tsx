// Define MockSetlist based on setlists table structure + songs relation
type MockSetlist = Database['public']['Tables']['setlists']['Row'] & { // <-- TypeScript compiler error here
    songs: MockSetlistSong[];
};