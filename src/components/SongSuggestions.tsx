id: crypto.randomUUID(),
                                  name: song.name,
                                  artist: song.artist,
                                  previewUrl: "",
                                  pitch: 0,
                                  originalKey: "C",
                                  targetKey: "C",
                                  isPlayed: false,
                                  isMetadataConfirmed: false,
                                  isKeyConfirmed: false,
                                  duration_seconds: 0,
                                  notes: "",
                                  lyrics: "",
                                  resources: [],
                                  user_tags: [],
                                  is_pitch_linked: true,
                                  isApproved: false,
                                  preferred_reader: null,
                                  ug_chords_config: DEFAULT_UG_CHORDS_CONFIG,
                                  is_ug_chords_present: false,
                                  highest_note_original: null,
                                  is_ug_link_verified: false,
                                  metadata_source: null,
                                  sync_status: 'IDLE',
                                  last_sync_log: null,
                                  auto_synced: false,
                                  is_sheet_verified: false,
                                  sheet_music_url: null,
                                  extraction_status: 'idle', 
                                })}
                                className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] rounded-lg gap-2 shadow-sm"
                              >
                                <ListPlus className="w-3.5 h-3.5" /> Add
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (